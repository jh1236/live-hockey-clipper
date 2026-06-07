import asyncio
import contextlib
import logging
import os
from datetime import datetime
from threading import Thread

import humps
from pony.orm import select, db_session, desc, flush
from quart import jsonify, send_file, request
from quart.blueprints import Blueprint
from sanitize_filename import sanitize

from ApiDatabaseLinkers import LiveHockeyManager, ClipsManager
from config import get_config
from database import Games, Clips, Competitions
from utils import DAY_IN_SEC, HOUR_IN_SEC, MINUTE_IN_SEC

clips_bp = Blueprint('clips_bp', __name__, url_prefix='/clips')


@clips_bp.post('/edit')
async def favourite_clip():
    with db_session():
        data = await request.json
        logging.error(data)
        game_id = data['gameId']
        clip_id = data['id']
        clip_name = data['clipName']
        categories = data['categories']
        favourite = bool(data['favourite'])
        game = Games[game_id]
        game_clips = Clips.select(lambda clip: clip.game == game)
        clip = [i for i in game_clips if i.id == clip_id][0]
        if clip is None:
            return 'Clip not found', 404

        clip.favourite = favourite
        if not favourite:
            unsaved_count = max(([int(i.name.split('Unsaved Clip ')[1]) for i in game_clips if
                                  not i.favourite and 'Unsaved Clip ' in i.name] + [0])) + 1
            clip.name = f'Unsaved Clip {unsaved_count}'
            clip.comment = ''
        else:
            clip.name = clip_name
            clip.comment = ';'.join(categories)
        clip.flush()

        return jsonify({'clip': clip.format_for_frontend()}), 200


@clips_bp.delete('/remove')
async def delete_clip():
    with db_session():
        data = await request.json
        clip_id = data['id']
        clip = Clips.get(id=clip_id)
        if clip is None:
            return 'Clip not found', 404

        file_path = f'{get_config().videos_folder}/{clip.game.id}/{clip.id}.mp4'
        clip.delete()
        flush()
        with contextlib.suppress(FileNotFoundError):
            os.remove(file_path)

        return '', 204


@clips_bp.get('/favourite/get')
async def get_favourite_clip():
    with db_session():
        clips = [i.format_for_frontend() for i in select(i for i in Clips if i.favourite)]
        return jsonify({'clips': clips}), 200


@clips_bp.post('/add')
async def add_clip():
    data = humps.decamelize(await request.json)
    logging.error(data)
    game_id = data['game_id']
    clip = ClipsManager.ClipDto(**data['clip'], id=None)
    quality = data['quality']
    username = data.get('username', None)
    password = data.get('password', None)

    with db_session():
        game = Games.get_by_identifier(game_id)
        if game is None:
            return 'Game not found', 404
        database_entry = clip.add_to_database(game.id)
        db_id = database_entry.id
        venue = database_entry.game.venue.code

    async def function():
        link = await ClipsManager.download_clip_for_game(game.live_hockey_id, database_entry, quality, venue, username,
                                                         password)
        with db_session():
            if not link:
                database_entry.delete()
            else:
                Clips[db_id].link = link

    pool = Thread(target=lambda: asyncio.run(function()), daemon=False)
    pool.start()
    pool.join()

    with db_session():
        clip_out = Clips[db_id]
        if not clip_out.link: return 'Bad Clip', 400
        return jsonify({'clip': clip_out.format_for_frontend()}), 200
