import asyncio
import json
import logging
import os
import shutil
from datetime import timedelta
from multiprocessing.process import current_process
from threading import Thread

from quart import Quart
from quart.wrappers.response import DataBody
from quart_cors import cors
from quart_tasks import QuartTasks

from blueprints import api
from config import get_config
from database import init_db
from populate_database import update_database
from utils import camelise

logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger().setLevel(logging.INFO)

app = Quart(__name__)
tasks = QuartTasks(app)
app.register_blueprint(api)

cors(app)

if not os.path.exists(get_config().database_path):
    shutil.copy('./resources/database.db', get_config().database_path)

init_db()


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
        new_body = [i if ' ' in i else camelise(i) for i in body]
    else:
        if ' ' in body:
            new_body = body
        else:
            new_body = camelise(body)
    encoded = json.dumps(new_body, separators=(',', ':')).encode('utf-8')
    response.headers.set('Content-Length', str(len(encoded)))
    response.response = DataBody(encoded)
    return response


def run_periodically():
    if current_process()._name == 'MainProcess':
        return
    
        

    worker_number = int(current_process()._name.split('-')[-1])
    if worker_number == 1:
        Thread(target=lambda: asyncio.run(update_database()), daemon=True).start()


@tasks.periodic(timedelta(hours=12))
async def update():
    run_periodically()


@app.before_serving
async def before_serving():
    if get_config().run_initial_checks:
        run_periodically()


if __name__ == '__main__':
    app.run()
