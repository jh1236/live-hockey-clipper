import asyncio
import logging
import os

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


@clips_bp.post('/favourite')
async def favourite_clip():
    with db_session():
        data = await request.json
        logging.error(data)
        blob = data['gameBlob']
        clip_name = data['clipName']
        favourite = bool(data['favourite'])

        game = Games.get(blob=blob)
        if game is None:
            return 'Game not found', 404

        clip = Clips.get(game_id=game.id, clip_name=clip_name)

        clip.favourite = favourite

        return jsonify({'clip': clip}), 200


@clips_bp.get('/favourite/get')
async def get_favourite_clip():
    with db_session():
        clips = [LiveHockeyManager.db_clip_to_DTO(i) for i in Clips.select(i for i in Clips if i.favourite)]
        return jsonify({'clips': clips}), 200


@clips_bp.post('/add')
async def add_clip():
    with db_session():
        data = await request.json
        logging.error(data)
        blob = data['gameBlob']
        clip = LiveHockeyManager.ClipDto(**data['clip'])
        quality = data['quality']
        username = data.get('username', None)
        password = data.get('password', None)

        game = Games.get(blob=blob)
        if game is None:
            return 'Game not found', 404

        return_clip = await LiveHockeyManager.download_clip_for_game(blob, clip, quality, username, password)

        if not return_clip:
            return 'Bad Clip', 400

        return_clip.add_to_database(game.id)

        return jsonify({'clip': return_clip}), 200


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

        clips = [LiveHockeyManager.db_clip_to_DTO(i) for i in Clips.select()]

        if not clips:
            return 'Bad Clip', 400

        tasks = []

        for clip in clips:
            tasks.append(LiveHockeyManager.download_clip_for_game(blob, clip, quality, username, password))

        out = await asyncio.gather(*tasks)

        return jsonify(out), 200


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
        clips = [LiveHockeyManager.fix_clip_for_js(i) for i in select(i for i in Clips if i.game_id == game)]

        return jsonify({'game': LiveHockeyManager.fix_game_for_js(game), 'clips': clips}), 200


@clips_bp.route('/<blob>/<clip>')
async def stream_file(blob, clip):
    """Serve the video stream files"""
    download = request.args.get('download', 'false').lower() == 'true'
    directory = os.path.join(get_config().videos_folder, sanitize(blob), sanitize(clip))
    return await send_file(directory, as_attachment=download)
