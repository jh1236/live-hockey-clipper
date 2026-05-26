import asyncio
import logging
import os
from datetime import datetime
from select import select
from typing import Any, Callable

from dateutil import parser
from pony.orm import db_session, select

from ApiManagers.live_hockey_utils.fetch_from_live_hockey import get_games_from_live_hockey, get_comps_from_live_hockey, \
    get_game_from_live_hockey
from ApiManagers.live_hockey_utils.fix_names import get_comp_details
from bridging import DBCodesManager, DatabaseAligner
from database import init_db, Competitions, Games
from utils import sleep_for_approx

logger = logging.Logger('LiveHockeyManager')


@db_session
def add_live_hockey_game_to_db(game: dict[str, Any]):
    start_time = parser.parse(game['start'])
    home_team_code = DBCodesManager.fix_code(game['homeTeam']['shortName'], 'live_hockey',
                                             name_for_diagnostic=game['homeTeam']['longName'])
    away_team_code = DBCodesManager.fix_code(game['awayTeam']['shortName'], 'live_hockey',
                                             name_for_diagnostic=game['awayTeam']['longName'])
    level, gender, year = get_comp_details(game['competition']['playerLevel']['name'])
    stream_start: str | None = game.get('streamStart', None)
    stream_start_time = round(parser.parse(stream_start).timestamp()) if stream_start is not None else None

    out = DatabaseAligner.get_or_create_game(
        home_team_code=home_team_code,
        home_team_long_name=game['homeTeam']['longName'],
        away_team_code=away_team_code,
        away_team_long_name=game['awayTeam']['longName'],
        start_time=start_time.timestamp(),
        level=level,
        year=year,
        gender=gender,
    )

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


async def update_games_from_live_hockey(location: str = 'hockeywa', filter_: Callable | None = None,
                                        date: int | None = None, target=8):
    competitions = await get_or_update_comps(location)
    filter_ = filter_ or (lambda a: True)
    page = 0
    upcoming_games = []
    while len([i for i in upcoming_games if filter_(i)]) < target:
        upcoming = await get_games_from_live_hockey(competitions, 4, True, date_from_in=date, page=page)
        if upcoming is None or len(upcoming) == 0:
            # this means we are out of pages
            break
        for i in upcoming:
            upcoming_games.append(add_live_hockey_game_to_db(i))
        await sleep_for_approx(0.5)
        page += 1

    page = 0
    recent_games = []
    while len([i for i in recent_games if filter_(i)]) < target:
        recent = await get_games_from_live_hockey(competitions, -4, True, date_from_in=date, page=page)
        if recent is None or len(recent) == 0:
            # this means we are out of pages
            break
        for i in recent:
            recent_games.append(add_live_hockey_game_to_db(i))
        await sleep_for_approx(0.5)
        page += 1


async def get_or_update_comps(location) -> list[Competitions]:
    with db_session():
        comps = select(i for i in Competitions if i.live_hockey_id)
        if comps:
            return list(comps)

        competitions = await get_comps_from_live_hockey(location)
        comps = []
        this_year = str(datetime.now().year)
        for i in competitions:
            if i.get('hidden', False) or this_year not in i['name']: continue
            level, gender, year = get_comp_details(i["name"])
            comp = DatabaseAligner.get_or_create_comp(year=year, gender=gender, level=level)
            comp.live_hockey_id = i['id']
            comps.append(comp)

        return comps


async def game_from_blob(blob: str):
    with db_session():
        game = Games.get(live_hockey_id=blob)
        if not game:
            game_json = await get_game_from_live_hockey(blob)
            game = add_live_hockey_game_to_db(game_json)
            game.flush()
            return game

        return game


if __name__ == '__main__':
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    init_db()
    asyncio.run(update_games_from_live_hockey())
