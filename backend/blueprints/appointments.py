import re
from collections import defaultdict
from dataclasses import field, dataclass
from datetime import datetime

from pony.orm import db_session, select
from quart import Blueprint, jsonify, request

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


@appointments_bp.route('/umpire_managers')
async def get_umpire_managers():
    with db_session():
        return jsonify({'umpire_managers': [i.format_for_frontend() for i in
                                            select(i for i in Officials if len(i.games_umpire_manager) > 0)]})


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

        @dataclass
        class UmpireStats:
            games: int = 0
            games_every_week: defaultdict[int, int] = field(default_factory=lambda: defaultdict(int))
            games_per_venue: defaultdict[str, int] = field(default_factory=lambda: defaultdict(int))
            years: list[int] = field(default_factory=list)
            competitions: list[Competitions] = field(default_factory=list)
            average_score_difference: float = 0
            games_with_score: int = 0
            average_ladder_position: float = 0
            average_ladder_difference: float = 0
            games_with_ladder: int = 0
            games_per_team: defaultdict[str, int] = field(default_factory=lambda: defaultdict(int))
            games_with_umpire_managers: defaultdict[str, int] = field(default_factory=lambda: defaultdict(int))
            averageGamesPerWeek: float = 0

        out: defaultdict[int, dict[str, UmpireStats]] = defaultdict(
            lambda: {
                'umpire_stats': UmpireStats(),
                'manager_stats': UmpireStats(),
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
            # or 0 is literally useless here, but the linter refuses to smart cast so....
            games = games.filter(lambda a: a.competition.year >= int(from_year or 0))
        if to_year is not None:
            games = games.filter(lambda a: a.competition.year <= int(to_year or 0))

        if umpire is not None:
            games = games.filter(lambda a: a.umpire_one.name == umpire or a.umpire_two.name == umpire)

        times = defaultdict(set)

        for g in games:
            for o, is_umpire_manager in [(g.umpire_one, False), (g.umpire_two, False), (g.umpire_manager, True)]:
                if not o or (umpire and not o.name == umpire): continue
                if not 'umpire' in out[o.id]:
                    out[o.id]['umpire'] = o.format_for_frontend()
                ump_dict: UmpireStats = out[o.id]['manager_stats' if is_umpire_manager else 'umpire_stats']
                ump_dict.games += 1
                monday = get_monday(g.start_time)
                monday_timestamp = 1000 * int(monday.timestamp())
                ump_dict.games_every_week[monday_timestamp] += 1
                times[monday.year].add(monday_timestamp)
                if g.home_team_score is not None:
                    # average score difference is not valid at this point
                    ump_dict.average_score_difference += abs(g.home_team_score - g.away_team_score)
                    ump_dict.games_with_score += 1

                ump_dict.games_per_team[g.home_team.code] += 1
                ump_dict.games_per_team[g.away_team.code] += 1

                home_team_pos: LadderPosition | None = \
                    ([i for i in g.home_team.ladder_positions if i.competition == g.competition] + [None])[0]

                away_team_pos: LadderPosition | None = \
                    ([i for i in g.away_team.ladder_positions if i.competition == g.competition] + [None])[0]

                if away_team_pos and home_team_pos:
                    ump_dict.average_ladder_difference += abs(home_team_pos.position - away_team_pos.position)
                    ump_dict.average_ladder_position += home_team_pos.position + away_team_pos.position
                    ump_dict.games_with_ladder += 1

                if g.umpire_manager:
                    ump_dict.games_with_umpire_managers[g.umpire_manager.name] += 1

                if monday.year not in ump_dict.years:
                    ump_dict.years.append(monday.year)
                if g.competition.id not in [i['id'] for i in ump_dict.competitions]:
                    ump_dict.competitions.append(g.competition.format_for_frontend())
                if g.venue:
                    ump_dict.games_per_venue[g.venue.code] += 1

        for k, v in out.items():
            if v['manager_stats'].games == 0:
                del v['manager_stats']
            if v['umpire_stats'].games == 0:
                del v['umpire_stats']
            for k2, v2 in v.items():
                if k2 == 'umpire': continue
                v2.average_games_per_week = round(
                    v2.games / (sum([len(times[i]) for i in v2.years]) or 1), 2)
                v2.average_ladder_difference = \
                    round(v2.average_ladder_difference / (v2.games_with_ladder or 1), 3)
                v2.average_games_per_week = round(
                    sum(v2.games_every_week.values()) / sum([len(times[i]) for i in v2.years]), 2)
                # times two as two teams per game
                v2.average_ladder_position = \
                    round(v2.average_ladder_position / ((v2.games_with_ladder or 1) * 2), 3)

                v2.average_score_difference = \
                    round(v2.average_score_difference / (v2.games_with_score or 1), 3)

        ret = list(sorted(out.values(), key=lambda a: a['umpire']['name']))
        if len(ret) == 1:
            ret = ret[0]
        return jsonify({'statistic': ret})


@appointments_bp.route('/per_email_provider_stats')
async def get_games_per_email():
    with (db_session()):
        gender = request.args.get('gender', None)
        level = request.args.get('level', None)
        from_year = request.args.get('from_year', None)
        to_year = request.args.get('to_year', None)

        out = defaultdict(
            lambda: {
                'games': 0,
                'umpires': set()
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

        for g in games:
            for o in [g.umpire_one, g.umpire_two]:
                if not o or not o.email: continue
                email = o.email.split('@')[1]
                email = re.sub(r'\.com?.*', '', email)
                email = re.sub(r'\.net.*', '', email)
                email = re.sub(r'\.wa.*', '', email)
                email = re.sub(r'\.au.*', '', email)
                ump_dict = out[email]
                ump_dict['games'] += 1
                ump_dict['umpires'].add(o.id)

        for k, v in out.items():
            v['email_provider'] = k
            v['umpires'] = len(v['umpires'])
        ret = list(out.values())
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
