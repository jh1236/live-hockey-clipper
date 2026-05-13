import dataclasses
import os
from collections import defaultdict
from urllib.request import urlopen
import cachetools.func

import math
from bs4 import BeautifulSoup
from dateutil import parser
from pony.orm import db_session, select

from database import Umpires, init_db

DEFAULT_TOURNAMENTS = [57, 58, 59, 60]


@dataclasses.dataclass
class Official:
    name: str
    gender: str
    id: int | None = None
    time_created: int | None = None


NAME_TO_CODE = {
    'Hale Hockey Club': 'HAL',
    'Victoria Park Xavier Hockey Club': 'VPX',
    'Curtin University Hockey Club': 'CUHC',
    'Westside Wolves Hockey Club': 'WOL',
    'YMCC Hockey Club': 'YMCC',
    'Old Aquinians Hockey Club': 'REDS',
    'Suburban Lions Hockey Club': 'SUBS',
    'Wesley South Perth Hockey Club': 'WASPS',
    'University of WA Hockey Club': 'UWA',
    'Melville City Hockey Club': 'MEL',
    'Whitford Hockey Club': 'WHIT',
    'North Coast Raiders Hockey Club': 'NCR',
    'Fremantle Cockburn Hockey Club': 'FCHC',
    'Newman Knights Hockey Club': 'NKHC',
    'Modernians - Old Guildfordians Mundaring Hockey Club': 'MOGM'
}

base_url = "https://hockeywa.altiusrt.com/competitions"


class Game:
    def __init__(self):
        self.teams: list[str] | None = None
        self.altius_id: str | None = None
        self.start_time: int = 0
        self.umpires: list[str] = []
        self.grade: str | None = None
        self.tournament_id: int | None


@cachetools.func.ttl_cache(ttl=60)
@db_session
def get_officials() -> dict[str, Official]:
    return {i.name: Official(**i.to_dict()) for i in select(c for c in Umpires)[:]}


@cachetools.func.ttl_cache(ttl=60)
def get_ladder(tournaments=None):
    if tournaments is None:
        tournaments = DEFAULT_TOURNAMENTS
    out: dict[int, list[str]] = defaultdict(list)
    for t in tournaments:
        html = _get_ladder_from_altius(t)
        soup = BeautifulSoup(html, "html.parser")
        table_container = soup.find("div", attrs={"class": "table-responsive"})
        table = table_container.find("table", attrs={"class": "table-hover"})
        trs = table.find_all("tr")[1:]  # we want to skip the header row
        for tr in trs:
            out[t].append(NAME_TO_CODE.get(str(tr.find_all("td")[1].find('a').contents[0])))
    return out


@cachetools.func.ttl_cache(ttl=60)
def get_appointments(tournaments: tuple[int] = None) -> list[Game]:
    if tournaments is None:
        tournaments = DEFAULT_TOURNAMENTS

    out: list[Game] = []
    for t in tournaments:
        html = _get_officials_from_altius(t)
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
                    game.start_time = math.floor(parser.parse(f'{date} {start_time}').timestamp() * 1000)
                    [game_name, game.grade] = teams.strip(')').split(" (")
                    game.teams = game_name.split(' v ')
                    umpires = [[i.string for i in children][5], [i.string for i in children][7]]
                else:
                    umpires = [[i.string for i in children][1], [i.string for i in children][2]]
                if teams is None:
                    continue
                umpires = [' '.join(reversed([j.title() for j in i.split(" (")[0].split(' ')])) for i in umpires if i]

                for j in umpires:
                    if not j.strip("\n\t"): continue
                    game.umpires.append(j)
                    if not j in get_officials():
                        print(f'Gender of umpire {j} is unknown!')
                        Umpires(name=j, gender='?')
                if game not in out:
                    out.append(game)
    out.sort(key=lambda i: i.start_time)
    return out


def _get_officials_from_altius(tournament):
    os.makedirs(f'/cache', exist_ok=True)
    if os.path.exists(f'/cache/{tournament}_officials.html'):
        with open(f'/cache/{tournament}_officials.html', 'r') as f:
            return f.read()
    page = urlopen(f"{base_url}/{tournament}/officials")
    html = page.read().decode("utf-8")
    with open(f'/cache/{tournament}_officials.html', 'w+') as f:
        f.write(html)
    return html


def _get_ladder_from_altius(tournament):
    os.makedirs(f'/cache', exist_ok=True)
    if os.path.exists(f'/cache/{tournament}_ladder.html'):
        with open(f'/cache/{tournament}_ladder.html', 'r') as f:
            return f.read()
    page = urlopen(f"{base_url}/{tournament}/pools")
    html = page.read().decode("utf-8")
    with open(f'/cache/{tournament}_ladder.html', 'w+') as f:
        f.write(html)
    return html


def update_altius_pages():
    os.makedirs(f'/cache', exist_ok=True)
    for i in DEFAULT_TOURNAMENTS:
        page = urlopen(f"{base_url}/{i}/officials")
        html = page.read().decode("utf-8")
        with open(f'/cache/{i}_officials.html', 'w+') as f:
            f.write(html)
        page = urlopen(f"{base_url}/{i}/pools")
        html = page.read().decode("utf-8")
        with open(f'/cache/{i}_ladder.html', 'w+') as f:
            f.write(html)

if __name__ == '__main__':
    init_db()
    print(get_officials())
