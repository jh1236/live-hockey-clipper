import asyncio
import datetime
import logging
import math
import os
import re
from collections import defaultdict

from bs4 import BeautifulSoup, Tag
from dateutil import parser
from pony.orm import select, db_session

from ApiManagers.altius_utils.fetch_from_altius import get_from_altius
from bridging import DatabaseAligner, DBCodesManager
from database import Competitions, init_db

from utils import sleep_for_approx

all_tournaments = [57, 58, 59, 60, 52, 51, 54, 53, 45, 46, 43, 44, 39, 40, 33, 34, 25, 26, 17, 18, 12, 11, 7, 8, 3, 4]


@db_session
def all_altius_tournaments() -> list[int]:
    return list(select(i.altius_id for i in Competitions if i.altius_id))


@db_session
def altius_tournaments_for_year(year: int) -> list[int]:
    return list(select(i.altius_id for i in Competitions if i.altius_id and i.year == year))


def _get_comp_from_altius_page(soup, altius_id):
    comp_header = soup.find("div", attrs={"class": "competition_header"})
    grade = comp_header.contents[1].text
    year = int(comp_header.contents[5].text.strip(" \n\t").split(' ')[-1])
    level = 'Prem Two' if any([i in grade.lower() for i in [' 2 ', ' two ']]) else 'Prem One'
    gender = 'M' if any([i in grade.lower() for i in [' men', ' male']]) else 'F'
    comp = DatabaseAligner.get_or_create_comp(level, gender, year)
    if not comp.altius_id:
        comp.altius_id = altius_id
    return gender, level, year


async def get_ladder(year='2026'):
    if year.lower() == 'all':
        tournaments = all_altius_tournaments()
    else:
        tournaments = altius_tournaments_for_year(int(year))
    out: dict[int, list[str]] = defaultdict(list)

    altius_pages = await get_from_altius(tournaments, 'ladder')
    for t, htmls in altius_pages.items():
        soup = BeautifulSoup(htmls['ladder'], "html.parser")
        table_container = soup.find("div", attrs={"class": "table-responsive"})
        table = table_container.find("table", attrs={"class": "table-hover"})
        trs = table.find_all("tr")[1:]  # we want to skip the header row
        for tr in trs:
            name = str(tr.find_all("td")[1].find('a').contents[0])
            name = DBCodesManager.prem_team_name_to_code(name)
            out[t].append(name)
    return out


async def fill_officials_from_altius(tournaments=None, year='2026'):
    if not tournaments:
        if year.lower() == 'all':
            tournaments = all_altius_tournaments()
        else:
            tournaments = altius_tournaments_for_year(int(year))

    altius_pages = await get_from_altius(tournaments, 'officials')
    with (db_session()):
        for t, html in altius_pages.items():
            soup = BeautifulSoup(html['officials'], "html.parser")
            gender, level, year = _get_comp_from_altius_page(soup, t)
            table_container = soup.find_all("div", {"class": "tab-content"})[1]
            for table in table_container.find_all("table"):
                date = table.parent.get('id').replace('appt_', '')
                rows = [i for i in table.find_all("tr")]
                team_one = None
                team_two = None
                umpires: list[str] = []
                start_time_int = -1
                for i in rows[1:]:  # skip the heading row
                    children = i.find_all()
                    if len(children) == 10:  # this row contains a time
                        teams = children[1].contents[0].text
                        start_time = children[1].contents[3].strip("\n\t")[:5]
                        start_time_int = math.floor(parser.parse(f'{date} {start_time} +0800').timestamp())
                        game_name = teams.split(" (")[0]
                        altius_id = children[1].find('a').get('href').split(r'/')[-1]
                        team_one, team_two = [DBCodesManager.fix_code(i, 'altius') for i in game_name.split(' v ')]
                        umpires = [[i.string for i in children][5]]
                    elif len(children) == 5:
                        if not team_one or \
                                not team_two or \
                                any(
                                    [' v ' in i.lower() or 'bye' in i.lower() for i in umpires if i]
                                ) or \
                                len(umpires) != 1:
                            continue
                        umpires.append([i.string for i in children][1])
                        game = DatabaseAligner.get_or_create_game(
                            home_team_code=team_one,
                            away_team_code=team_two,
                            start_time=start_time_int,
                            gender=gender,
                            level=level,
                            year=year,
                        )
                        if not game.altius_id:
                            game.altius_id = altius_id
                        umpires = [' '.join(reversed([j.title() for j in i.split(" (")[0].split(' ')])) for i in umpires
                                   if
                                   i and
                                   i.strip(' \n\t')]
                        if len(umpires) > 0:
                            game.official_one = DatabaseAligner.get_or_create_official(umpires[0])
                            if len(umpires) > 1:
                                game.official_two = DatabaseAligner.get_or_create_official(umpires[1])


async def fill_venues_from_altius(tournaments=None, year='2026'):
    if not tournaments:
        if year.lower() == 'all':
            tournaments = all_altius_tournaments()
        else:
            tournaments = altius_tournaments_for_year(int(year))

    altius_pages = await get_from_altius(tournaments, 'games')
    with (db_session()):
        for t, html in altius_pages.items():
            soup = BeautifulSoup(html['games'], "html.parser")
            gender, level, year = _get_comp_from_altius_page(soup, t)
            table_container = soup.find("div", attrs={"class": "table-responsive"})
            table = table_container.find("table", attrs={"class": "table-hover"})
            trs = table.find_all("tr")[1:]  # we want to skip the header row
            for tr in trs:
                start_time_int = parser.parse(
                    f'{tr.find("span", {"data-datetimelocal__notimechange": True}).get("data-datetimelocal__notimechange")} +0800').timestamp()
                game_name_col = tr.find('a', {'href': re.compile(r'^https://hockeywa.altiusrt.com/matches/')})
                game_name = game_name_col.contents[0].text.split(' (')[0].split(' v ')
                if 'BYE' in game_name:
                    continue
                home_team, away_team = [DBCodesManager.fix_code(i, 'altius') for i in game_name]

                score_col = tr.find("td", attrs={"style": "white-space:nowrap;"})
                venue_col = [i for i in score_col.next_siblings if isinstance(i, Tag)][1]
                if not venue_col:
                    continue

                game = DatabaseAligner.get_or_create_game(home_team_code=home_team, away_team_code=away_team,
                                                      start_time=start_time_int, gender=gender, level=level, year=year)
                if not game.altius_id:
                    game.altius_id = game_name_col.get('href').split('/')[-1]
                venue = venue_col.contents[0].text.strip(' \n\t')
                try:
                    code = 'PHS' if venue.lower() in ['turf 1', 'turf 2'] else DBCodesManager.venue_name_to_code(venue)
                except Exception as e:
                    logging.error('MATCH ID: %s', game_name_col.get('href').split('/')[-1])
                    raise e

                if ' - ' in score_col:
                    game.home_team_score, game.away_team_score = \
                    score_col.contents[0].text.replace(' AET', '').strip(' \n\tSO)').split('(')[-1].split(' - ', 1)
                turf_number = 2 if any(i in venue.lower() for i in ['2', 'two']) else 1
                game.venue = DatabaseAligner.get_or_create_venue(code=code, turf_number=turf_number)



async def update_altius_pages():
    logging.warning('Launching Altius Update')
    tournaments = altius_tournaments_for_year(datetime.datetime.now().year)
    await get_from_altius(tournaments, 'games', 'ladder', 'officials')
    logging.warning('Altius Update Successful')


if __name__ == '__main__':
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    os.environ['CACHE_DIRECTORY'] = '../cache'
    init_db()
    asyncio.run(fill_venues_from_altius(tournaments=reversed(all_tournaments)))
