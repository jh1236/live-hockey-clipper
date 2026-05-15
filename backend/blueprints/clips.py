import os

import requests
from flask import jsonify, send_file, request
from flask.blueprints import Blueprint
from pony.orm import select

import LiveHockeyManager
from database import Games, Clips
from utils import time_to_int


clips_bp = Blueprint('clips_bp', __name__, url_prefix='/clips')

@clips_bp.post('/add')
def add_clip():
    data = request.json
    blob = data['gameBlob']
    clip = LiveHockeyManager.Clip(**data['clip'])
    quality = data['quality']
    username = data.get('username', None)
    password = data.get('password', None)

    game = Games.get(blob=blob)
    if game is None:
        return 'Game not found', 404

    return_clip = LiveHockeyManager.download_clip_for_game(blob, clip, quality, username, password)

    if not return_clip:
        return 'Bad Clip', 400

    Clips(
        game_id=game,
        name=return_clip.name,
        start_time=time_to_int(return_clip.timecode),
        duration=time_to_int(return_clip.length),
        link=return_clip.link,
        comment=return_clip.comment,
    )

    return jsonify({'clip': return_clip}), 200


@clips_bp.route('/games/recent')
def get_recent_games_web():
    location = request.args.get('location', '')
    juniors = request.args.get('juniors') == 'true'
    premier_only = request.args.get('premier') == 'true'
    masters = request.args.get('masters') == 'true'
    recent, upcoming = LiveHockeyManager.get_recent_games(location, juniors, premier_only, masters)

    return jsonify({'upcoming': upcoming, 'recent': recent})



@clips_bp.get('/games/<blob>')
def get_game(blob):
    game = Games.get(blob=blob)
    if not game:
        game = requests.get(f'https://api.livearenasports.com/broadcast/{blob}',
                            headers={'site-id': 'AU_FH_AUS'}).json()
        game = LiveHockeyManager.live_hockey_game_to_db_game(game)
        game.save_to_db()
        return jsonify({'game': LiveHockeyManager.fix_game_for_js(game), 'clips': []}), 200
    print(type(game))
    clips = [LiveHockeyManager.fix_clip_for_js(i) for i in select(i for i in Clips if i.game_id == game)]

    return jsonify({'game': LiveHockeyManager.fix_game_for_js(game), 'clips': clips}), 200


@clips_bp.route('/<blob>/<clip>')
def stream_file(blob, clip):
    """Serve the video stream files"""
    directory = os.path.join('/videos/output', blob, clip)
    return send_file(directory)
