from collections import defaultdict
from datetime import datetime

from pony.orm import db_session, select
from quart import Blueprint, jsonify, request

from ApiDatabaseLinkers import AltiusManager
from bridging import DatabaseAligner
from database import Competitions, Games, Officials
from utils import get_monday

appointments_bp = Blueprint('appointments_bp', __name__, url_prefix='/appointments')


@appointments_bp.route('/ladder')
async def ladder():  # put application's code here
    year = request.args.get('year', str(datetime.now().year))
    return await AltiusManager.get_ladder(year=year)


@appointments_bp.route('/available')
async def get_available():
    with db_session():
        return jsonify([i.format_for_frontend() for i in select(i for i in Competitions if i.altius_id)])


@appointments_bp.route('/umpires')
async def get_umpires():
    with db_session():
        return jsonify({'umpires':[i.format_for_frontend() for i in Officials.select()]})


@appointments_bp.route('/')
async def get_appointments_web():  # put application's code here
    with db_session():
        year = request.args.get('year', str(datetime.now().year))
        return jsonify(
            [i.format_for_frontend() for i in select(i for i in Games if i.umpire_one and i.competition.year == year)])


@appointments_bp.route('/per_umpire_stats')
async def get_games_per_umpire():
    with db_session():
        gender = request.args.get('gender', None)
        level = request.args.get('level', None)
        year = request.args.get('year', None)
        out = defaultdict(lambda: {'games_umpired': 0, 'games_umpired_every_week': defaultdict(lambda: 0),
                                   'games_umpired_per_venue': defaultdict(lambda: 0)})

        comps = select(i for i in Competitions)
        if gender is not None:
            comps = comps.filter(lambda a: a.gender == gender)
        if level is not None:
            comps = comps.filter(lambda a: a.level == level)
        if year is not None:
            comps = comps.filter(lambda a: a.year == year)

        for c in comps:
            for g in c.games:
                for o in [g.umpire_one, g.umpire_two]:
                    if not o: continue
                    out[o.id]['umpire'] = o.format_for_frontend()
                    out[o.id]['games_umpired'] += 1
                    out[o.id]['games_umpired_every_week'][1000 * int(get_monday(g.start_time).timestamp())] += 1
                    if g.venue:
                        out[o.id]['games_umpired_per_venue'][g.venue.code] += 1

        return jsonify({'statistic': list(sorted(out.values(), key=lambda a: a['umpire']['name']))})


@appointments_bp.route('/per_week_stats')
async def get_games_per_week():
    with db_session():
        gender = request.args.get('gender', None)
        level = request.args.get('level', None)
        year = request.args.get('year', None)
        out = defaultdict(lambda: defaultdict(int))

        comps = select(i for i in Competitions)
        if gender is not None:
            comps = comps.filter(lambda a: a.gender == gender)
        if level is not None:
            comps = comps.filter(lambda a: a.level == level)
        if year is not None:
            comps = comps.filter(lambda a: a.year == year)

        for c in comps:
            for g in c.games:
                for o in [g.umpire_one, g.umpire_two]:
                    if not o: continue
                    key = 1000 * int(get_monday(g.start_time).timestamp())
                    out[key][o.name] += 1

        return jsonify({'statistic': out})
