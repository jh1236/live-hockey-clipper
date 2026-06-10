import asyncio
import logging
from datetime import datetime

from pony.orm import db_session, flush, select
from quart import Blueprint, jsonify, request

from ApiDatabaseLinkers import LiveHockeyManager
from database import Games
from utils import MINUTE_IN_SEC, HOUR_IN_SEC, DAY_IN_SEC

games_bp = Blueprint('games', __name__, url_prefix='/games')


@games_bp.route('/recent')
async def get_recent_games():
    with db_session():
        juniors = request.args.get('juniors') == 'true'
        premier_only = request.args.get('premier') == 'true'
        masters = request.args.get('masters') == 'true'
        umpires = request.args.getlist('umpire')
        venue = request.args.get('venue', None)
        teams = request.args.getlist('team')
        only_clippable = request.args.get('clippable') == 'true'

        acceptable_ages = ['Seniors']
        if masters:
            acceptable_ages.append('Masters')
        if juniors:
            acceptable_ages.append('Juniors')

        query = select(
            i for i in Games
        )

        for u in umpires:
            query = query.filter(lambda i: i.umpire_one.name == u or i.umpire_two.name == u)

        for t in teams:
            query = query.filter(lambda i: i.home_team.code == t or i.away_team.code == t)

        if venue is not None:
            query = query.filter(lambda i: i.venue.short_name == venue)

        if premier_only:
            query = query.filter(lambda i: i.competition.is_premier == True)

        if only_clippable:
            query = query.filter(lambda i: i.live_hockey_id != None)

        if not masters:
            query = query.filter(lambda i: i.competition.age_level != 'Masters')

        if not juniors:
            query = query.filter(lambda i: i.competition.age_level != 'Juniors')

        games = list(query)

        for i in games:
            i.complete |= i.start_time + 1.5 * HOUR_IN_SEC < datetime.now().timestamp()

        recent_games = sorted([i for i in games if i.complete], key=lambda g: g.start_time, reverse=True)
        if len(recent_games) > 8:
            recent_games = recent_games[:8]

        upcoming_games = sorted([i for i in games if not i.complete], key=lambda g: g.start_time)
        if len(upcoming_games) > 8:
            upcoming_games = upcoming_games[:8]

        this_year = datetime.now().year
        live_hockey_missing_games = [i for i in recent_games if
                                     i.competition.year == this_year and i.live_hockey_id == None and i.venue.has_video]

    
        logging.warning(f'Games "{[i.name for i in live_hockey_missing_games]}" have not been populated.')
        while len(live_hockey_missing_games) > 0:
            i = live_hockey_missing_games[0]
            logging.warning(
                f'Getting games from {datetime.fromtimestamp(i.start_time)} ({len(live_hockey_missing_games)} games remain).')
            await LiveHockeyManager.update_live_hockey(date=i.start_time, date_window=3)
            live_hockey_missing_games = [i for i in live_hockey_missing_games[1:] if not i.live_hockey_id]
    
        recent = [
            i.format_for_frontend() for i in recent_games
        ]
        upcoming = [
            i.format_for_frontend() for i in
            upcoming_games
        ]
    
        return jsonify({'upcoming': upcoming, 'recent': recent})


@games_bp.get('/blob/<blob>')
async def get_game_by_blob(blob):
    with db_session():
        game = Games.get(live_hockey_id=blob)
        if not game:
            game = await LiveHockeyManager.game_from_blob(blob)
            game.flush()
        return jsonify({'game': game.format_for_frontend(), 'clips': []}), 200


@games_bp.get('/<game_identifier>')
async def get_game(game_identifier):
    with db_session():
        game = Games.get_by_identifier(game_identifier)
        if not game:
            start = datetime.strptime(f"{game_identifier.split('-')[0]}.{game_identifier.split('~')[1]}.+0800",
                                      '%Y.%d.%m.%H.%M.%z')
            await LiveHockeyManager.update_live_hockey(date=int(start.timestamp()))
            game = Games.get_by_identifier(game_identifier)
        if not game.stream_start_time and game.start_time - 15 * MINUTE_IN_SEC < datetime.now().timestamp():
            game = await LiveHockeyManager.game_from_blob(game.live_hockey_id)
        return jsonify(
            {'game': game.format_for_frontend(),
             'clips': [i.format_for_frontend() for i in sorted(game.clips, key=lambda it: it.time_created)]}), 200
