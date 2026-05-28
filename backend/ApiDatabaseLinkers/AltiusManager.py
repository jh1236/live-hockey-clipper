import asyncio
import datetime
import logging
import math
import os
import re
from collections import defaultdict

from bs4 import BeautifulSoup, Tag, PageElement, NavigableString
from dateutil import parser
from pony.orm import select, db_session

from ApiFetchers import AltiusFetcher
from bridging import DatabaseAligner, DBCodesManager
from database import Competitions, init_db, Officials, LadderPosition
from utils import chunks, fix_last_first_name

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
    comp = DatabaseAligner.get_or_create_comp(year, level, gender)
    if not comp.altius_id:
        comp.altius_id = altius_id
    return comp


async def get_ladder(year='2026'):
    with db_session():
        if year.lower() == 'all':
            tournaments = all_altius_tournaments()
        else:
            tournaments = altius_tournaments_for_year(int(year))
        out: dict[int, list[str]] = defaultdict(list)

        altius_pages = await AltiusFetcher.get_from_altius(tournaments, 'ladder')

        for t, htmls in altius_pages.items():
            # remove the ladder that is listed and replace it
            soup = BeautifulSoup(htmls['ladder'], "html.parser")
            
            comp = _get_comp_from_altius_page(soup, t)
            existing_ladder = select(i for i in LadderPosition if i.competition == comp)
            existing_ladder = {i.team.code: i for i in existing_ladder}
            
            table_container = soup.find("div", attrs={"class": "table-responsive"})
            table = table_container.find("table", attrs={"class": "table-hover"})
            trs = table.find_all("tr")[1:]  # we want to skip the header row
            for pos, tr in enumerate(trs, start=1):
                name = str(tr.find_all("td")[1].find('a').contents[0])
                code = DBCodesManager.prem_team_name_to_code(name)
                if code in existing_ladder:
                    existing_ladder[code].position = pos
                else:
                    LadderPosition(team=DatabaseAligner.get_or_create_team(code), competition=comp, position=pos)


async def fill_officials_from_altius(tournaments=None, year='2026'):
    if not tournaments:
        if year.lower() == 'all':
            tournaments = all_altius_tournaments()
        else:
            tournaments = altius_tournaments_for_year(int(year))

    altius_pages = await AltiusFetcher.get_from_altius(tournaments, 'officials')
    with (db_session()):
        for t, html in altius_pages.items():
            soup = BeautifulSoup(html['officials'], "html.parser")
            competition = _get_comp_from_altius_page(soup, t)
            table_container = soup.find_all("div", {"class": "tab-content"})[1]
            for table in table_container.find_all("table"):
                date = table.parent.get('id').replace('appt_', '')
                rows: list[Tag] = [i for i in table.find_all("tr")]
                for [top_row, bottom_row] in chunks(rows[1:], 2):  # skip the heading row
                    top_row: Tag
                    bottom_row: Tag
                    team_link = top_row.find('a', attrs={
                        'href': re.compile(r'^https://hockeywa\.altiusrt\.com/matches/\d+$')
                    })
                    teams = team_link.text
                    game_name_entry = team_link.parent
                    start_time = game_name_entry.contents[3].text.strip("\n\t")[:5]
                    start_time_int = math.floor(parser.parse(f'{date} {start_time} +0800').timestamp())
                    game_name = teams.split(" (")[0]
                    altius_id = team_link.get('href').split(r'/')[-1]
                    if 'BYE' in game_name:
                        continue
                    team_one, team_two = [DBCodesManager.fix_code(i, 'altius') for i in game_name.split(' v ')]

                    roles = ['Umpire', 'Umpire', 'Technical Official', 'Technical Official']
                    top_row_officials: list[Officials | None] = [None] * 4
                    current: list[Tag] = [i for i in game_name_entry.next_siblings if isinstance(i, Tag)]
                    for i, tag in enumerate(current):
                        name_entry = tag.find('a')
                        if not name_entry: continue

                        name = DBCodesManager.fix_official_name(fix_last_first_name(name_entry.text.split(' (')[0]))
                        top_row_officials[i] = DatabaseAligner.get_or_create_official(name, role_if_new=roles[i])

                    roles = ['Umpire', 'Umpire', 'Technical Official']
                    bottom_row_officials: list[Officials | None] = [None] * 4
                    current: list[Tag] = [i for i in bottom_row if isinstance(i, Tag)]
                    for i, tag in enumerate(current):
                        name_entry = tag.find('a')
                        if not name_entry: continue

                        name = DBCodesManager.fix_official_name(fix_last_first_name(name_entry.text.split(' (')[0]))
                        bottom_row_officials[i] = DatabaseAligner.get_or_create_official(name, role_if_new=roles[i])

                    game = DatabaseAligner.get_or_create_game(
                        home_team_code=team_one,
                        away_team_code=team_two,
                        start_time=start_time_int,
                        competition=competition,
                    )
                    game.umpire_one = top_row_officials[0]
                    game.reserve_umpire = top_row_officials[1]
                    game.scoring_judge = top_row_officials[2]
                    game.tech_official = top_row_officials[3]

                    game.umpire_two = bottom_row_officials[0]
                    game.timing_judge = bottom_row_officials[2]
                    if not game.altius_id:
                        game.altius_id = int(altius_id)


async def fill_venues_from_altius(tournaments=None, year='2026'):
    if not tournaments:
        if year.lower() == 'all':
            tournaments = all_altius_tournaments()
        else:
            tournaments = altius_tournaments_for_year(int(year))

    altius_pages = await AltiusFetcher.get_from_altius(tournaments, 'games')
    with (db_session()):
        for t, html in altius_pages.items():
            soup = BeautifulSoup(html['games'], "html.parser")
            competition = _get_comp_from_altius_page(soup, t)
            table_container = soup.find("div", attrs={"class": "table-responsive"})
            table = table_container.find("table", attrs={"class": "table-hover"})
            trs = table.find_all("tr")[1:]  # we want to skip the header row
            for tr in trs:
                parse = parser.parse(
                    f'{tr.find("span", {"data-datetimelocal__notimechange": True}).get("data-datetimelocal__notimechange")} +0800')
                start_time_int = parse.timestamp()
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
                                                          start_time=start_time_int, competition=competition)
                if not game.altius_id:
                    game.altius_id = game_name_col.get('href').split('/')[-1]
                venue = venue_col.contents[0].text.strip(' \n\t')

                code = 'PHS' if venue.lower() in ['turf 1', 'turf 2'] else DBCodesManager.venue_name_to_code(venue)

                if re.search(r'\d', score_col.text):
                    game.home_team_score, game.away_team_score = (
                        score_col.text
                        .replace(' AET', '')  # remove after extra time
                        .strip(' \n\tSO)')  # remove trailing whitespace and SO text
                        .split('(')[-1]  # take shoot out score if tied
                        .split(' - ', 1)
                    )
                turf_number = 2 if any(i in venue.lower() for i in ['2', 'two']) else 1
                game.venue = DatabaseAligner.get_or_create_venue(code=code, turf_number=turf_number)


async def update_altius_pages(tournaments=None):
    logging.warning('Launching Altius Update')
    tournaments = tournaments or altius_tournaments_for_year(datetime.datetime.now().year)
    await AltiusFetcher.get_from_altius(tournaments, 'games', 'ladder', 'officials', force_regen=True)
    logging.warning('Altius Update Successful')
    await fill_venues_from_altius(tournaments)
    await fill_officials_from_altius(tournaments)


if __name__ == '__main__':
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    os.environ['CACHE_DIRECTORY'] = '../cache'
    init_db()
    asyncio.run(get_ladder('all'))
