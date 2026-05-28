from collections import defaultdict
from datetime import datetime
from typing import Any

from pony.orm import db_session, select
from quart import Blueprint, jsonify, request

from ApiDatabaseLinkers import AltiusManager
from database import Competitions, Games, Officials, LadderPosition
from utils import get_monday

appointments_bp = Blueprint('appointments_bp', __name__, url_prefix='/appointments')


@appointments_bp.route('/ladder')
async def ladder():  # put application's code here
    with db_session():
        year = request.args.get('year', str(datetime.now().year))
        ladder = select(i for i in LadderPosition if year == 'all' or i.competition.year == int(year))
        out = defaultdict(lambda: defaultdict(list))
        for i in ladder:
            comp_name = f'{i.competition.level} {'Men' if i.competition.gender == "M" else 'Women'}'
            year = out[i.competition.year]
            while len(year[comp_name]) < i.position:
                year[comp_name].append(None)
            year[comp_name][i.position - 1] = i.team.format_for_frontend()
        return jsonify({'ladder': out})


@appointments_bp.route('/available')
async def get_available():
    with db_session():
        comps = set()
        for i in Games.select():
            if not i.umpire_one: continue
            comps.add(i.competition)
        return jsonify([i.format_for_frontend() for i in comps])


@appointments_bp.route('/umpires')
async def get_umpires():
    with db_session():
        return jsonify({'umpires': [i.format_for_frontend() for i in Officials.select()]})


@appointments_bp.route('/')
async def get_appointments_web():  # put application's code here
    with db_session():
        year = request.args.get('year', str(datetime.now().year))
        return jsonify(
            [i.format_for_frontend() for i in select(i for i in Games if i.umpire_one and i.competition.year == year)])


@appointments_bp.route('/per_umpire_stats')
async def get_games_per_umpire():
    with (db_session()):
        umpire = request.args.get('umpire', None)
        gender = request.args.get('gender', None)
        level = request.args.get('level', None)
        from_year = request.args.get('from_year', None)
        to_year = request.args.get('to_year', None)


        out: defaultdict[Any, dict[str, float | defaultdict[Any, int] | list[Any]]] = defaultdict(
            lambda: {
                'games_umpired': 0,
                'games_umpired_every_week': defaultdict(int),
                'games_umpired_per_venue': defaultdict(int),
                'years_umpired': [],
                'average_score_difference': 0,
                'average_ladder_difference': 0,
                'average_ladder_position': 0,
                'games_per_team': defaultdict(int),
                'games_with_umpire_managers': defaultdict(int),
            })

        non_returned_values = defaultdict(lambda: {
            'scored_games': 0,
            'ladder_games': 0,
        })

        games = select(i for i in Games)
        if gender is not None:
            games = games.filter(lambda a: a.competition.gender == gender)
        if level is not None and level.lower() != 'all':
            if level.lower() == 'premier':
                games = games.filter(lambda a: a.competition.altius_id != None)
            else:
                games = games.filter(lambda a: a.competition.level == level)
        if from_year is not None:
            games = games.filter(lambda a: a.competition.year >= int(from_year))
        if to_year is not None:
            games = games.filter(lambda a: a.competition.year <= int(to_year))

        if umpire is not None:
            games = games.filter(lambda a: a.umpire_one.name == umpire or a.umpire_two.name == umpire)

        times = defaultdict(set)

        for g in games:
            for o in [g.umpire_one, g.umpire_two]:
                if not o or umpire and not o.name == umpire: continue
                ump_dict = out[o.id]
                ump_dict['umpire'] = o.format_for_frontend()
                ump_dict['games_umpired'] += 1
                monday = get_monday(g.start_time)
                monday_timestamp = 1000 * int(monday.timestamp())
                ump_dict['games_umpired_every_week'][monday_timestamp] += 1
                times[monday.year].add(monday_timestamp)
                if g.home_team_score is not None:
                    # average score difference is not valid at this point
                    ump_dict['average_score_difference'] += abs(g.home_team_score - g.away_team_score)
                    non_returned_values[o.id]['scored_games'] += 1

                ump_dict['games_per_team'][g.home_team.code] += 1
                ump_dict['games_per_team'][g.away_team.code] += 1

                home_team_pos: LadderPosition | None = \
                    ([i for i in g.home_team.ladder_positions if i.competition == g.competition] + [None])[0]

                away_team_pos: LadderPosition | None = \
                    ([i for i in g.away_team.ladder_positions if i.competition == g.competition] + [None])[0]

                if away_team_pos and home_team_pos:
                    ump_dict['average_ladder_difference'] += abs(home_team_pos.position - away_team_pos.position)
                    ump_dict['average_ladder_position'] += home_team_pos.position + away_team_pos.position
                    non_returned_values[o.id]['ladder_games'] += 1

                if g.umpire_manager:
                    ump_dict['games_with_umpire_managers'][g.umpire_manager.name] += 1

                if monday.year not in ump_dict['years_umpired']:
                    ump_dict['years_umpired'].append(monday.year)
                if g.venue:
                    ump_dict['games_umpired_per_venue'][g.venue.code] += 1

        for k, v in out.items():
            v['average_games_per_week'] = round(
                sum(v['games_umpired_every_week'].values()) / sum([len(times[i]) for i in v['years_umpired']]), 2)
            v['average_ladder_difference'] = \
                round(v['average_ladder_difference'] / (non_returned_values[k]['ladder_games'] or 1), 3)

            # times two as two teams per game
            v['average_ladder_position'] = \
                round(v['average_ladder_position'] / ((non_returned_values[k]['ladder_games'] or 1) * 2), 3)
            v['average_score_difference'] = \
                round(v['average_score_difference'] / (non_returned_values[k]['scored_games'] or 1), 3)

        ret = list(sorted(out.values(), key=lambda a: a['umpire']['name']))
        if len(ret) == 1:
            ret = ret[0]
        return jsonify({'statistic': ret})


@appointments_bp.route('/per_week_stats')
async def get_games_per_week():
    with db_session():
        gender = request.args.get('gender', None)
        level = request.args.get('level', None)
        to_year = request.args.get('to_year', None)
        from_year = request.args.get('from_year', None)
        out = defaultdict(lambda: defaultdict(int))

        games = select(i for i in Games)
        if gender is not None:
            games = games.filter(lambda a: a.competition.gender == gender)
        if level is not None and level.lower() != 'all':
            if level.lower() == 'premier':
                games = games.filter(lambda a: a.competition.altius_id != None)
            else:
                games = games.filter(lambda a: a.competition.level == level)
        if from_year is not None:
            games = games.filter(lambda a: a.competition.year >= int(from_year))
        if to_year is not None:
            games = games.filter(lambda a: a.competition.year <= int(to_year))

        for g in games:
            for o in [g.umpire_one, g.umpire_two]:
                if not o: continue
                key = 1000 * int(get_monday(g.start_time).timestamp())
                out[key][o.name] += 1

        return jsonify({'statistic': out})
