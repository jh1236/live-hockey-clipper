import asyncio
import logging
import os
import re
from datetime import datetime, timedelta
from select import select
from typing import Any, Callable

from dateutil import parser
from pony.orm import db_session, select

from ApiFetchers import LiveHockeyFetcher
from bridging import DBCodesManager, DatabaseAligner
from database import init_db, Competitions, Games
from utils import sleep_for_approx, NUMBERS

logger = logging.Logger('LiveHockeyManager')


def _get_comp(comp) -> Competitions:
    this_year = datetime.now().year
    comp = re.sub(r'^[\d\s]*wa ', '', comp.lower()).strip()
    if comp.startswith("j"):
        # Juniors
        comp = comp[2:]  # remove the J and the trailing space
        age, comp_and_div = comp.split(' ', 1)
        gender = 'M' if comp_and_div.split(' ')[-1] == 'boys' else 'F'
        comp_and_div = comp_and_div.replace('division ', '')
        comp_and_div = comp_and_div.split(' ')[:-1]

        if len(comp_and_div) > 1:
            # this grade has black and Gold
            comp_and_div, grade = comp_and_div
            grade = re.sub('[()]', '', grade)
            comp = f'{age} Div {NUMBERS[int(comp_and_div[0])]} {grade}'
        else:
            comp = f'{age} Div {NUMBERS[int(comp_and_div[0])]}'
    else:
        if comp.startswith('r'):
            # this is rae blunt - and it doesn't have a dash before the gender (god knows why)
            comp = comp.replace('women', '- women')
        comp, gender = comp.split(' - ')
        comp = comp.strip()
        gender = 'F' if 'women' in gender else 'M'
        if comp.startswith("o") or comp.startswith("r"):
            # Masters
            comp.replace('div div', 'div')
            if 'pool' not in comp:
                if comp[0] == 'r':
                    # edge case for o35 d1
                    age = 'o35'
                    div = '1'
                elif comp == 'o35 midweek':
                    age = 'o35'
                    div = '1'
                else:
                    age, div = comp.replace(' div', '').split(' ')
                comp = f'{age} Div {NUMBERS[int(div)]}'
        elif 'premier' in comp:
            # premier divisions
            if any([i in comp for i in ['2', 'two']]):
                comp = 'Prem Two'
            elif any([i in comp for i in ['3', 'three']]):
                comp = 'Prem Three'
            else:
                comp = 'Prem One'
        else:
            # Seniors
            grade_number = re.sub('div(ision)? ', '', comp).strip()
            if ' ' in grade_number:
                grade_number, black_or_gold = grade_number.split(' ')
                black_or_gold = re.sub('[()]', '', black_or_gold)
                comp = f'Div {NUMBERS[int(grade_number)]} {black_or_gold}'
            else:
                comp = f'Div {NUMBERS[int(grade_number)]}'
    return DatabaseAligner.get_or_create_comp(this_year, comp, gender)


@db_session
def add_live_hockey_game_to_db(game: dict[str, Any], source: str):
    start_time = parser.parse(game['start'])
    home_team_code = DBCodesManager.fix_code(game['homeTeam']['shortName'], 'live_hockey',
                                             name_for_diagnostic=game['homeTeam']['longName'])
    away_team_code = DBCodesManager.fix_code(game['awayTeam']['shortName'], 'live_hockey',
                                             name_for_diagnostic=game['awayTeam']['longName'])
    competition = _get_comp(game['competition']['playerLevel']['name'])
    stream_start: str | None = game.get('streamStart', None)
    stream_start_time = round(parser.parse(stream_start).timestamp()) if stream_start is not None else None

    out = DatabaseAligner.get_or_create_game(
        home_team_code=home_team_code,
        home_team_long_name=game['homeTeam']['longName'],
        away_team_code=away_team_code,
        away_team_long_name=game['awayTeam']['longName'],
        start_time=start_time.timestamp(),
        competition=competition,
        source=f'Live Hockey {source}',
    )

    if (
            game.get('streamEnd', False) or
            start_time.timestamp() < (datetime.now() + timedelta(hours=1, minutes=30)).timestamp()
    ):
        out.complete = True

    if game['extSrc'] == 'ALT_WA':
        if not out.altius_id:
            out.altius_id = game['extId']
    else:
        out.teamstar_id = game['extId']
    out.live_hockey_id = game['id']
    out.stream_start_time = stream_start_time

    if not out.home_team.image_link and game['homeTeam'].get('logo', None):
        out.home_team.image_link = f"https://files.livearenasports.com/files/{game['homeTeam']['logo']['blobId']}"
    if not out.away_team.image_link and game['awayTeam'].get('logo', None):
        out.away_team.image_link = f"https://files.livearenasports.com/files/{game['awayTeam']['logo']['blobId']}"

    return out


async def update_live_hockey(location: str = 'hockeywa', filter_: Callable | None = None,
                             date: int | None = None, target=-1):
    competitions = await get_or_update_comps(location)
    filter_ = filter_ or (lambda a: True)
    page = 0
    upcoming_games = []
    while target == -1 or len([i for i in upcoming_games if filter_(i)]) < target:
        upcoming = await LiveHockeyFetcher.get_games_from_live_hockey(competitions, 7, True, date_from_in=date,
                                                                      page=page)
        if upcoming is None or len(upcoming) == 0:
            # this means we are out of pages
            break
        for i in upcoming:
            upcoming_games.append(add_live_hockey_game_to_db(i, 'Upcoming'))
        await sleep_for_approx(0.5)
        page += 1

    page = 0
    recent_games = []
    while target == -1 or len([i for i in recent_games if filter_(i)]) < target:
        recent = await LiveHockeyFetcher.get_games_from_live_hockey(competitions, -7, True, date_from_in=date,
                                                                    page=page)
        if recent is None or len(recent) == 0:
            # this means we are out of pages
            break
        for i in recent:
            recent_games.append(add_live_hockey_game_to_db(i, 'Recent'))
        await sleep_for_approx(0.5)
        page += 1


async def get_or_update_comps(location) -> list[Competitions]:
    with db_session():
        comps = select(i for i in Competitions if i.live_hockey_id)
        if comps:
            return list(comps)

        competitions = await LiveHockeyFetcher.get_comps_from_live_hockey(location)
        comps = []
        this_year = str(datetime.now().year)
        for i in competitions:
            if i.get('hidden', False) or this_year not in i['name']: continue
            comp = _get_comp(i["name"])
            comp.live_hockey_id = i['id']
            comps.append(comp)

        return comps


async def game_from_blob(blob: str):
    with db_session():
        game = Games.get(live_hockey_id=blob)
        if not game:
            game_json = await LiveHockeyFetcher.get_game_from_live_hockey(blob)
            game = add_live_hockey_game_to_db(game_json)
            game.flush()
            return game

        return game


if __name__ == '__main__':
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    init_db()
    asyncio.run(update_live_hockey())
