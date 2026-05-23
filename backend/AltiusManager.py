import asyncio
import dataclasses
import datetime
import logging
import math
import os
import re
from collections import defaultdict
from functools import reduce

from bs4 import BeautifulSoup
from dateutil import parser
from pony.orm import db_session, select

from config import get_config
from requester import client
from database import Umpires, init_db


@dataclasses.dataclass
class Official:
    name: str
    gender: str
    id: int | None = None
    time_created: int | None = None


YEAR_TO_TOURNAMENT_ID = {
    2026: {
        "Prem One Men": 57,
        "Prem One Women": 58,
        "Prem Two Men": 59,
        "Prem Two Women": 60,
    },
    2025: {
        "Prem One Men": 52,
        "Prem One Women": 51,
        "Prem Two Men": 54,
        "Prem Two Women": 53,
    },
    2024: {
        "Prem One Men": 45,
        "Prem One Women": 46,
        "Prem Two Men": 43,
        "Prem Two Women": 44,
    },
    2023: {
        "Prem One Men": 39,
        "Prem One Women": 40
    },
    2022: {
        "Prem One Men": 33,
        "Prem One Women": 34
    },
    2021: {
        "Prem One Men": 25,
        "Prem One Women": 26
    },
    2020: {
        "Prem One Men": 17,
        "Prem One Women": 18
    },
    2019: {
        "Prem One Men": 12,
        "Prem One Women": 11
    },
    2018: {
        "Prem One Men": 7,
        "Prem One Women": 8
    },
    2017: {
        "Prem One Men": 3,
        "Prem One Women": 4
    }
}

TOURNAMENT_ID_TO_GRADE = reduce(lambda og, new: og | {v: k for k, v in new.items()}, YEAR_TO_TOURNAMENT_ID.values(), {})

FIX_ALTIUS_CODE = {
    'HAL': 'HAL',
    'VPX': 'VPX',
    'CUHC': 'CUHC',
    'WOL': 'WOL',
    'YMCC': 'YMCC',
    'REDS': 'REDS',
    'SUBS': 'SUBS',
    'WASPS': 'WASPS',
    'UWA': 'UWA',
    'MEL': 'MEL',
    'WHIT': 'WHIT',
    'NCR': 'NCR',
    'FCHC': 'FCHC',
    'NKHC': 'NKHC',
    'MOGM': 'MOGM',
    'WOLVES': 'WOL',
    'WHC': 'WHIT',
    'LIONS': 'SUBS',
    'RDHC': 'RDHC',
    'WSP': 'WASPS',
    'OA': 'REDS',
    'CUH': 'CUHC',
    'LION': 'LIONS',
    'HALE': 'HAL',
    'OGM': 'OGMHC',
    'FRE': 'FCHC',
    'YM': 'YMCC',
    'OGMHC': 'OGMHC',
    'MODS': 'MODS',
    'WOLV': 'WOL',
    'MELV': 'MEL'
}


def name_to_code(name):
    NAME_TO_CODE = {
        'hale': 'HAL',
        'vic': 'VPX',
        'curtin': 'CUHC',
        'wolves': 'WOL',
        'ymcc': 'YMCC',
        'ymca': 'YMCC',
        'reds': 'REDS',
        'aquin': 'REDS',
        'sub': 'SUBS',
        'lions': 'SUBS',
        'wasp': 'WASPS',
        'wesley': 'WASPS',
        'uwa': 'UWA',
        'western australia': 'UWA',
        'university of wa': 'UWA',
        'melville': 'MEL',
        'whitford': 'WHIT',
        'raiders': 'NCR',
        'fremantle': 'FCHC',
        'newman': 'NKHC',
        'modernians': 'MODS',
        'ogm': 'OGMHC',
        'guildford': 'OGMHC',
        'rockingham': 'RDHC',
    }
    name = name.lower()
    if 'mods' in name and ('ogm' in name or 'guildford' in name):
        return 'MOGM'
    for i in NAME_TO_CODE:
        if i in name:
            return NAME_TO_CODE[i]
    logging.error(f'Unknown teamname {name}')
    return None


base_url = "https://hockeywa.altiusrt.com/competitions"


class Game:
    def __init__(self):
        self.teams: list[str] | None = None
        self.altius_id: str | None = None
        self.start_time: int = 0
        self.umpires: list[str] = []
        self.grade: str | None = None
        self.tournament_id: int | None


@db_session
def get_officials() -> dict[str, Official]:
    return {i.name: Official(**i.to_dict()) for i in select(c for c in Umpires)[:]}


async def get_ladder(year='2026'):
    if year.lower() == 'all':
        tournaments = TOURNAMENT_ID_TO_GRADE.keys()
    else:
        tournaments = YEAR_TO_TOURNAMENT_ID[int(year)].values()
    out: dict[int, list[str]] = defaultdict(list)
    async def fetch(i):
        return i, await _get_ladder_from_altius(i)

    htmls: list[tuple[int, str]] = await asyncio.gather(*[fetch(i) for i in tournaments])
    for t, html in htmls:
        soup = BeautifulSoup(html, "html.parser")
        table_container = soup.find("div", attrs={"class": "table-responsive"})
        table = table_container.find("table", attrs={"class": "table-hover"})
        trs = table.find_all("tr")[1:]  # we want to skip the header row
        for tr in trs:
            name = str(tr.find_all("td")[1].find('a').contents[0])
            name = name_to_code(name)
            if not name:
                out[t].append(None)
                continue
            out[t].append(name)
    return out


async def get_appointments(tournament=None, year='2026') -> list[Game]:
    if tournament:
        tournaments = [tournament]
    elif year.lower() == 'all':
        tournaments = TOURNAMENT_ID_TO_GRADE.keys()
    else:
        tournaments = YEAR_TO_TOURNAMENT_ID[int(year)].values()
    out: list[Game] = []

    async def fetch(i):
        return i, await _get_officials_from_altius(i)

    htmls: list[tuple[int, str]] = await asyncio.gather(*[fetch(i) for i in tournaments])
    for t, html in htmls:
        soup = BeautifulSoup(html, "html.parser")
        table_container = soup.find_all("div", {"class": "tab-content"})[1]
        for table in table_container.find_all("table"):
            date = table.parent.get('id').replace('appt_', '')
            rows = [i for i in table.find_all("tr")]
            game = Game()
            teams = None
            for i in rows[1:]:  # skip the heading row
                children = i.find_all()
                if len(children) > 9:  # this row contains a time
                    teams = children[1].contents[0].text
                    altius_id = children[1].find('a').get('href')
                    start_time = children[1].contents[3].strip("\n\t")[:5]
                    game = Game()
                    game.tournament_id = t
                    game.altius_id = altius_id
                    game.start_time = math.floor(parser.parse(f'{date} {start_time} +0800').timestamp() * 1000)
                    game_name = teams.split(" (")[0]
                    game.grade = TOURNAMENT_ID_TO_GRADE[t]
                    game.teams = [FIX_ALTIUS_CODE[re.sub(r'\d$', '', i)] for i in game_name.split(' v ')]
                    umpires = [[i.string for i in children][5], [i.string for i in children][7]]
                else:
                    umpires = [[i.string for i in children][1], [i.string for i in children][2]]
                if teams is None:
                    continue
                umpires = [' '.join(reversed([j.title() for j in i.split(" (")[0].split(' ')])) for i in umpires if i]
                if umpires and any(' V ' in i for i in umpires):
                    # crude Bye handling
                    continue

                for j in umpires:
                    if not j.strip("\n\t"): continue
                    game.umpires.append(j)
                    if not j in get_officials():
                        print(f'Gender of umpire {j} is unknown!')
                        @db_session
                        def add_umpire():
                            Umpires(name=j, gender='?')
                        add_umpire()
                if game not in out:
                    out.append(game)
    out.sort(key=lambda i: i.start_time)
    return out


async def _get_officials_from_altius(tournament, force_regen=False):
    cache_folder = get_config().cache_folder
    os.makedirs(cache_folder, exist_ok=True)
    if os.path.exists(f'{cache_folder}/{tournament}_officials.html') and not force_regen:
        with open(f'{cache_folder}/{tournament}_officials.html', 'r') as f:
            return f.read()
    page = await client.get(f"{base_url}/{tournament}/officials")
    html = page.read().decode("utf-8")
    with open(f'{cache_folder}/{tournament}_officials.html', 'w+') as f:
        f.write(html)
    return html


async def _get_ladder_from_altius(tournament, force_regen=False):
    cache_folder = get_config().cache_folder
    os.makedirs(cache_folder, exist_ok=True)
    if os.path.exists(f'{cache_folder}/{tournament}_ladder.html') and not force_regen:
        with open(f'{cache_folder}/{tournament}_ladder.html', 'r') as f:
            return f.read()
    page = await client.get(f"{base_url}/{tournament}/pools")
    html = page.read().decode("utf-8")
    with open(f'{cache_folder}/{tournament}_ladder.html', 'w+') as f:
        f.write(html)
    return html


async def update_altius_pages():
    import LiveHockeyManager
    # reset the cache - we have new data
    logging.warning('Launching Altius Update')
    LiveHockeyManager.get_recent_games.RECENT_GAMES_RESPONSES = {}
    tasks = []
    for i in YEAR_TO_TOURNAMENT_ID[datetime.datetime.now().year].values():
        tasks += [_get_officials_from_altius(i, True), _get_ladder_from_altius(i, True)]
    await asyncio.gather(*tasks)
    logging.warning('Altius Update Successful')


if __name__ == '__main__':
    init_db()
    print(get_officials())
