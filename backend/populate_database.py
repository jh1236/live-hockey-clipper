import asyncio
import logging
import sqlite3
import traceback
from datetime import datetime

from pony.orm import flush

from ApiDatabaseLinkers import LiveHockeyManager, AltiusManager, WhistleIQManager
from ApiFetchers import AltiusFetcher
from config import get_config
from database import init_db

default_config = [
    ['Altius Updater', AltiusManager.update_altius_pages],
    ['Live Hockey Updater', LiveHockeyManager.update_live_hockey],
    ['Whistle IQ Updater', WhistleIQManager.update_whistle_iq]
]

def nuke_db():
    con = sqlite3.connect(get_config().database_path)
    cur = con.cursor()
    cur.execute('''
                DELETE
                FROM clips;
                DELETE
                FROM competitions;
                DELETE
                FROM games;
                DELETE
                FROM game_cards;
                DELETE
                FROM ladder_position;
                DELETE
                FROM users;
                UPDATE sqlite_sequence
                SET seq = 0
                WHERE name in ('clips', 'competitions', 'games', 'game_cards', 'ladder_positions', 'users')''')

async def populate_empty_database():
    name = "Historic Altius Updater"
    logging.info(f'Beginning task "{name}"')
    tournaments = []
    this_year = datetime.now().year
    for k, v in AltiusManager.YEAR_TO_TOURNAMENT_ID.items():
        if k >= this_year:
            continue
        tournaments += v.values()
    await AltiusManager.update_altius_pages(tournaments, force_regen=False)
    logging.info(f'Completed task "{name}"')
    flush()
    await update_database()


async def update_database(config=None):
    config = config if config is not None else default_config
    for [name, task] in config:
        logging.info(f'Beginning task "{name}"')
        try:
            await task()
            flush()
            logging.info(f'Completed task "{name}"')
        except Exception as e:
            logging.error(f'Exception {type(e).__name__} while running task "{name}"')
            logging.error(traceback.format_exc())


if __name__ == '__main__':
    init_db()
    logging.getLogger('httpx').setLevel(logging.WARNING)
    AltiusFetcher.altius_logger.setLevel(logging.DEBUG)
    asyncio.run(update_database())
