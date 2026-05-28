import asyncio
import json
import logging
import os
import shutil
from datetime import timedelta
from multiprocessing.process import current_process

import humps
from quart import Quart
from quart.wrappers.response import DataBody
from quart_cors import cors
from quart_tasks import QuartTasks

from ApiDatabaseLinkers import ClipsManager, AltiusManager, WhistleIQManager, LiveHockeyManager
from blueprints import api
from config import get_config
from database import init_db
from utils import camelise

logging.getLogger().setLevel(logging.INFO)

app = Quart(__name__)
tasks = QuartTasks(app)
app.register_blueprint(api)

cors(app)

if not os.path.exists(get_config().database_path):
    shutil.copy('./resources/database.db', get_config().database_path)

init_db()


@app.before_request
async def before_request():
    pass


@app.after_request
async def to_camel_case(response):
    if response.status[0] != '2':
        return response
    body = response.response
    if isinstance(body, DataBody):
        body = [i async for i in body]
    if not isinstance(body, list) or len(body) != 1:
        return response
    body = body[0]
    if not body:
        return response
    body = json.loads(body)
    if isinstance(body, dict):
        new_body = camelise(body)
    elif isinstance(body, list):
        new_body = [i if ' ' in i else humps.camelize(i) for i in body]
    else:
        if ' ' in body:
            new_body = body
        else:
            new_body = humps.camelize(body)
    encoded = json.dumps(new_body, separators=(',', ':')).encode('utf-8')
    response.headers.set('Content-Length', str(len(encoded)))
    response.response = DataBody(encoded)
    return response


async def run_periodically():
    print(get_config())
    worker_number = int(current_process()._name.split('-')[-1])
    config = [['Altius Updater', AltiusManager.update_altius_pages], ['Whistle IQ Updater', WhistleIQManager.update_appointments],
              ['Live Hockey Updater', LiveHockeyManager.update_live_hockey], ['Stale Clip remover', ClipsManager.remove_old_videos]]

    for [name, task] in config:
        if worker_number == 1:
            logging.warning(f'Beginning task "{name}"')
            await task()
            logging.warning(f'Completed task "{name}"')


@tasks.periodic(timedelta(minutes=30))
async def update():
    await run_periodically()


@app.before_serving
async def before_serving():
    await run_periodically()


if __name__ == '__main__':
    app.run()
