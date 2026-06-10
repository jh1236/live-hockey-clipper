import asyncio
import json
import os
import time
from datetime import datetime, timedelta

from pony.orm import db_session

from ApiFetchers import WhistleIQFetcher
from bridging import DatabaseAligner, DBCodesManager
from database import init_db, Competitions
from utils import sleep_for_approx, HOUR_IN_SEC


def _get_comp_details(label, year) -> Competitions:
    label = label.lower()
    gender = 'M' if any(i in label for i in ['boy', ' men']) else 'F'
    if 'premier' in label:
        if any(i in label for i in ['2', 'two']):
            comp = 'Prem Two'
        elif any(i in label for i in ['3', 'three']):
            comp = 'Prem Three'
        else:
            comp = 'Prem One'
    elif label.startswith('j'):
        comp = label[2:].split(' ', 1)[0] + ' Div One'
    elif label[0].isdigit():
        comp = label.split(' ', 1)[0] + ' Div One'
    else:
        raise ValueError(f'Invalid comp label "{label}"')

    return DatabaseAligner.get_or_create_comp(year, comp.title(), gender)


async def update_umpires(org=None):
    # sorted like this so that the first games to populate are from premier league
    org = org or await WhistleIQFetcher.get_hwa_organisation()
    this_year = datetime.now().year
    out = []
    with db_session():
        for i in org["users"]:
            name = DBCodesManager.fix_human_name(f"{i['firstName']} {i['lastName']}")
            gender = i['sex'].strip() or '?'
            umpire = DatabaseAligner.get_or_create_official(name, gender_if_new=gender)
            umpire.email = i['email'].strip() or None
            if not umpire.phone_number:
                umpire.phone_number = i['mobile'].strip() or None
        for i in sorted(org["events"], key=lambda it: ('Rising' in it['name'], '2025' in it['name'])):
            for a in i['assignments']:
                name = DBCodesManager.fix_human_name(f"{a['firstName']} {a['lastName']}")
                gender = a['sex'].strip() or '?'
                umpire = DatabaseAligner.get_or_create_official(name, gender_if_new=gender)
                is_um = a['roleCode'] == 'UM'
                if str(this_year) in i['startDateSQL']:
                    umpire.panel = a['panelName']
                if not umpire.role or umpire.role == 'Technical Official':
                    if (
                            a['panelName'].strip() and
                            not umpire.panel and
                            (not is_um or a['panelName'] not in ['RS 1st Year', 'Standard Panel'])
                    ):
                        umpire.role = 'Umpire' if is_um else a['roleName']
                    else:
                        umpire.role = a['roleName']
                out.append(umpire)


async def update_appointments(org=None):
    events = (org or await WhistleIQFetcher.get_hwa_organisation())["events"]
    
    for event in events:
        year = event['startDateSQL'].split('-')[0]
        games = await WhistleIQFetcher.get_event_games(event['guid'])
        await sleep_for_approx(1)
        with db_session():
            for game in games:
                label = game['competitionName']
                if not label.strip():
                    continue
                competition = _get_comp_details(label, year)

                if not competition.whistle_iq_id:
                    competition.whistle_iq_id = game['competitionGuid']

                home_team = DBCodesManager.name_to_code(game['homeTeam'])
                away_team = DBCodesManager.name_to_code(game['awayTeam'])

                start_time = int(game['fixtureDateUNIX']) - 8 * HOUR_IN_SEC

                db_game = DatabaseAligner.get_or_create_game(home_team, away_team, start_time, competition,
                                                             source='WhistleIQ appointments')

                if start_time < (datetime.now() + timedelta(hours=1, minutes=30)).timestamp():
                    db_game.complete = True

                if not db_game.venue:
                    turf_number = 2 if any(i in game['subVenue'].lower() for i in ['2', 'two']) else 1
                    venue_code = DBCodesManager.venue_name_to_code(game['venueName'])
                    db_game.venue = DatabaseAligner.get_or_create_venue(venue_code, turf_number)

                umpires = []
                umpire_manager = None
                for i in game['assignments']:
                    name = DBCodesManager.fix_human_name(f"{i['firstName']} {i['lastName']}")
                    official = DatabaseAligner.get_or_create_official(name)
                    match i['roleCode']:
                        case 'U1' | 'U2':
                            umpires.append(official)
                        case 'UM':
                            umpire_manager = official

                if (
                        umpires and
                        (not db_game.umpire_one or sorted(umpires) != sorted([db_game.umpire_one, db_game.umpire_two]))
                ):
                    db_game.umpire_one = umpires[0]
                    if len(umpires) > 1:
                        db_game.umpire_two = umpires[1]

                db_game.umpire_manager = umpire_manager


async def update_whistle_iq():
    org = await WhistleIQFetcher.get_hwa_organisation()
    WhistleIQFetcher.whistle_iq_logger.info('Filling Umpires')
    await update_umpires(org=org)
    WhistleIQFetcher.whistle_iq_logger.info('Filling Appointments')
    await update_appointments(org=org)


if __name__ == '__main__':
    os.environ['WHISTLE_IQ_PWD'] = 'Jared'
    os.environ['WHISTLE_IQ_USER'] = 'healy_jared@yahoo.com'
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    init_db()
    asyncio.run(update_whistle_iq())
    time.sleep(2)
