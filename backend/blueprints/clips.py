import asyncio
import logging
import os
from datetime import datetime

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
        os.remove(file_path)

        return '', 204


@clips_bp.get('/favourite/get')
async def get_favourite_clip():
    with db_session():
        clips = [i.format_for_frontend() for i in select(i for i in Clips if i.favourite)]
        return jsonify({'clips': clips}), 200


@clips_bp.post('/add')
async def add_clip():
    with db_session():
        data = humps.decamelize(await request.json)
        logging.error(data)
        game_id = data['game_id']
        clip = ClipsManager.ClipDto(**data['clip'], id=None)
        quality = data['quality']
        username = data.get('username', None)
        password = data.get('password', None)

        game = Games.get_by_identifier(game_id)
        if game is None:
            return 'Game not found', 404

        database_entry = clip.add_to_database(game.id)
        link = await ClipsManager.download_clip_for_game(game.live_hockey_id, database_entry, quality, username,
                                                         password)
        database_entry.link = link
        if not link:
            database_entry.delete()
            return 'Bad Clip', 400

        return jsonify({'clip': database_entry.format_for_frontend()}), 200


@clips_bp.post('/regenerate')
async def regenerate_clip():
    with db_session():

        data = await request.json
        game_id = data['gameId']
        quality = data['quality']
        username = data.get('username', None)
        password = data.get('password', None)

        game = Games.get(id=game_id)
        if game is None:
            return 'Game not found', 404

        clips = list(Clips.select())

        if not clips:
            return 'Bad Clip', 400

        async def worker(clip):
            link = await ClipsManager.download_clip_for_game(game.live_hockey_id, clip, quality, username, password)
            clip.link = link
            return clip

        out = await asyncio.gather(*[worker(i) for i in clips])

        return jsonify({'clips': out}), 200



@clips_bp.route('/<clip_id>')
async def stream_file(clip_id):
    """Serve the video stream files"""
    with db_session():
        clip = Clips[int(clip_id)]
        download = request.args.get('download', 'false').lower() == 'true'
        directory = os.path.join(get_config().videos_folder, f'{clip.game.id}', sanitize(f'{clip.id}.mp4'))
        if download:
            name = f'{clip.game.name}{f'- {clip.name}' if not clip.name.startswith("Unsaved") else ''}.mp4'
            return await send_file(directory, as_attachment=True, attachment_filename=name)
        else:
            return await send_file(directory, as_attachment=False)
