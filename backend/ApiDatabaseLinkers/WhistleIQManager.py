import asyncio
import json
import os
from collections import defaultdict

from pony.orm import db_session

from ApiFetchers import WhistleIQFetcher
from bridging import DatabaseAligner
from database import init_db, Officials


async def update_umpires():
    events = sorted(await WhistleIQFetcher.get_events(), key=lambda it: 'Rising' in it['name'])
    out = []
    bad_names = set()
    with db_session():
        for i in events:
            if '2025' in i['startDateSQL']:
                continue
            for a in i['assignments']:
                name = f"{a['firstName']} {a['lastName']}"
                gender = a['sex'].strip() or '?'
                if Officials.get(name=name) == None:
                    bad_names.add(name)
                    continue
                umpire = DatabaseAligner.get_or_create_official(name, gender=gender)
                is_um = a['roleCode'] == 'UM'
                if (
                        a['panelName'].strip() and
                        not umpire.panel and
                        not (is_um or a['panelName'] not in ['RS 1st Year', 'Standard Panel'])
                ):
                    umpire.panel = a['panelName']
                out.append(umpire)
    print('\n'.join([json.dumps(i.format_for_frontend()) for i in out]))
    print('\n'.join(bad_names))


async def update_appointments():
    pass


if __name__ == '__main__':
    os.environ['WHISTLE_IQ_PWD'] = 'Jared'
    os.environ['WHISTLE_IQ_USER'] = 'healy_jared@yahoo.com'
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    init_db()
    asyncio.run(update_umpires())
