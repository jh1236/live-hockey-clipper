import asyncio
import logging
import os

import humps
from pony.orm import select, db_session
from quart import jsonify, send_file, request
from quart.blueprints import Blueprint
from sanitize_filename import sanitize

import AltiusManager
import LiveHockeyManager
from config import get_config
from database import Games, Clips
from requester import client
from utils import time_to_int

clips_bp = Blueprint('clips_bp', __name__, url_prefix='/clips')


@clips_bp.post('/edit')
async def favourite_clip():
    with db_session():
        data = await request.json
        logging.error(data)
        blob = data['gameBlob']
        clip_id = data['id']
        clip_name = data['clipName']
        categories = data['categories']
        favourite = bool(data['favourite'])
        game = Games.get(blob=blob)
        game_clips = Clips.select(lambda clip: clip.game_id == game)
        clip = [i for i in game_clips if i.id == clip_id][0]
        if clip is None:
            return 'Clip not found', 404

        dto = LiveHockeyManager.db_clip_to_DTO(clip)
        clip.favourite = favourite
        dto.favourite = favourite
        if not favourite:
            unsaved_count = max(([int(i.name.split('Unsaved Clip ')[1]) for i in game_clips if
                                  not i.favourite and 'Unsaved Clip ' in i.name] + [0])) + 1
            clip.name = f'Unsaved Clip {unsaved_count}'
            dto.name = f'Unsaved Clip {unsaved_count}'
            clip.comment = ''
            dto.categories = []
        else:
            clip.name = clip_name
            dto.name = clip_name
            clip.comment = ';'.join(categories)
            dto.categories = categories

        return jsonify({'clip': dto}), 200


@clips_bp.delete('/remove')
async def delete_clip():
    with db_session():
        data = await request.json
        clip_id = data['id']
        clip = Clips.get(id=clip_id)
        if clip is None:
            return 'Clip not found', 404

        file_path = f'{get_config().videos_folder}/{clip.link.split("/api/clips/")[1]}'
        clip.delete()
        os.remove(file_path)
        
        return '', 204


@clips_bp.get('/favourite/get')
async def get_favourite_clip():
    with db_session():
        clips = [LiveHockeyManager.db_clip_to_DTO(i) for i in select(i for i in Clips if i.favourite)]
        return jsonify({'clips': clips}), 200


@clips_bp.post('/add')
async def add_clip():
    with db_session():
        data = humps.decamelize(await request.json)
        logging.error(data)
        blob = data['game_blob']
        clip = LiveHockeyManager.ClipDto(**data['clip'], id=None)
        quality = data['quality']
        username = data.get('username', None)
        password = data.get('password', None)

        game = Games.get(blob=blob)
        if game is None:
            return 'Game not found', 404

        database_entry = clip.add_to_database(game.id)
        link = await LiveHockeyManager.download_clip_for_game(blob, database_entry, quality, username, password)
        database_entry.link = link
        if not link:
            database_entry.delete()
            return 'Bad Clip', 400

        return jsonify({'clip': LiveHockeyManager.db_clip_to_DTO(database_entry)}), 200


@clips_bp.post('/regenerate')
async def regenerate_clip():
    with db_session():

        data = await request.json
        blob = data['gameBlob']
        quality = data['quality']
        username = data.get('username', None)
        password = data.get('password', None)

        game = Games.get(blob=blob)
        if game is None:
            return 'Game not found', 404

        clips = list(Clips.select())

        if not clips:
            return 'Bad Clip', 400

        async def worker(clip):
            link = await LiveHockeyManager.download_clip_for_game(blob, clip, quality, username, password)
            clip.link = link
            return clip

        out = await asyncio.gather(*[worker(i) for i in clips])

        return jsonify({'clips': out}), 200


@clips_bp.route('/games/recent')
async def get_recent_games_web():
    location = request.args.get('location', '')
    juniors = request.args.get('juniors') == 'true'
    premier_only = request.args.get('premier') == 'true'
    masters = request.args.get('masters') == 'true'
    recent, upcoming = await LiveHockeyManager.get_recent_games(location, juniors, premier_only, masters)

    return jsonify({'upcoming': upcoming, 'recent': recent})


@clips_bp.get('/games/<blob>')
async def get_game(blob):
    with db_session():
        game = Games.get(blob=blob)
        if not game:
            game, appointments = await asyncio.gather(
                client.get(f'https://api.livearenasports.com/broadcast/{blob}', headers={'site-id': 'AU_FH_AUS'}),
                AltiusManager.get_appointments())
            game = game.json()
            game = LiveHockeyManager.live_hockey_game_to_db_game(game, appointments)
            game.save_to_db()
            return jsonify({'game': LiveHockeyManager.fix_game_for_js(game), 'clips': []}), 200
        print(type(game))
        clips = [LiveHockeyManager.db_clip_to_DTO(i) for i in select(i for i in Clips if i.game_id == game)]

        return jsonify({'game': LiveHockeyManager.fix_game_for_js(game), 'clips': clips}), 200


@clips_bp.route('/<blob>/<clip>')
async def stream_file(blob, clip):
    """Serve the video stream files"""
    download = request.args.get('download', 'false').lower() == 'true'
    directory = os.path.join(get_config().videos_folder, sanitize(blob), sanitize(clip))
    return await send_file(directory, as_attachment=download)
