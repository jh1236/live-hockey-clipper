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
from database import Games, Clips

clips_bp = Blueprint('clips_bp', __name__, url_prefix='/clips')
HOUR_IN_SEC = 60 * 60
DAY_IN_SEC = HOUR_IN_SEC * 24


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

        game = Games[game_id]
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


@clips_bp.route('/games/recent')
async def get_recent_games():
    with db_session():
        location = request.args.get('location', 'hockeywa')
        juniors = request.args.get('juniors') == 'true'
        premier_only = request.args.get('premier') == 'true'
        masters = request.args.get('masters') == 'true'

        acceptable_ages = ['Seniors']
        if masters:
            acceptable_ages.append('Masters')
        if juniors:
            acceptable_ages.append('Juniors')

        flush()
        now = datetime.now().timestamp()
        recent = [
            i.format_for_frontend() for i in
            select(
                i for i in Games
                if i.complete
                and i.competition.age_level in acceptable_ages
                and (i.competition.is_premier or not premier_only)
                and i.live_hockey_id
                and i.start_time < now + 4 * DAY_IN_SEC
            ).order_by(desc(Games.start_time)).limit(8)
        ]
        upcoming = [
            i.format_for_frontend() for i in
            select(
                i for i in Games if
                i.complete == False
                and i.competition.age_level in acceptable_ages
                and (i.competition.is_premier or not premier_only)
                and i.live_hockey_id
                and i.start_time > now - 4 * DAY_IN_SEC
            ).order_by(Games.start_time).limit(8)
        ]

        return jsonify({'upcoming': upcoming, 'recent': recent})


@clips_bp.get('/games/blob/<blob>')
async def get_game_by_blob(blob):
    with db_session():
        game = Games.get(live_hockey_id=blob)
        if not game:
            game = await LiveHockeyManager.game_from_blob(blob)
            return jsonify({'game': game.format_for_frontend(), 'clips': []}), 200


@clips_bp.get('/games/<game_id>')
async def get_game(game_id):
    with db_session():
        game = Games.get(id=game_id)
        return jsonify(
            {'game': game.format_for_frontend(), 'clips': [i.format_for_frontend() for i in sorted(game.clips, key=lambda it: it.time_created)]}), 200


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


@clips_bp.route('/get')
async def get_clip_by_id():
    with db_session():
        clip_id = int(request.args.get('id'))
        clip = Clips.get(id=clip_id).format_for_frontend()
        return jsonify({'clip': clip}), 200
