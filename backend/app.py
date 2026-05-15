import atexit
import json
import logging
import os
import shutil
import threading

import humps
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask
from flask_cors import CORS
from pony.flask import Pony

from blueprints import api
from database import init_db
from AltiusManager import update_altius_pages

logging.getLogger().setLevel(logging.INFO)


def scheduled():
    logging.info('Getting updates from altius')
    update_altius_pages()


scheduler = BackgroundScheduler()

atexit.register(scheduler.shutdown)

# update the altius w/o halting startup
threading.Thread(target=scheduled).start()

scheduler.add_job(scheduled, 'interval', minutes=30)
scheduler.start()

DAY_IN_MS = 1000 * 60 * 60 * 24
HOUR_IN_MS = 1000 * 60 * 60
app = Flask(__name__)
app.register_blueprint(api)

CORS(app)
Pony(app)

if not os.path.exists('/database/database.db'):
    shutil.copy('./resources/database.db', '/database/database.db')

init_db()


@app.after_request
def to_camel_case(response):
    if response.status[0] != '2':
        return response
    body = response.response
    if not isinstance(body, list) or len(body) != 1:
        return response
    body = body[0]
    body = json.loads(body)
    if isinstance(body, dict):
        new_body = humps.camelize(
            {k: v for k, v in body.items() if ' ' not in k}) | {k: v for k, v in body.items() if ' ' in k}
    elif isinstance(body, list):
        new_body = [i if ' ' in i else humps.camelize(i) for i in body]
    else:
        if ' ' in body:
            new_body = body
        else:
            new_body = humps.camelize(body)
    encoded = json.dumps(new_body, separators=(',', ':')).encode('utf-8')
    response.headers.set('Content-Length', str(len(encoded)))
    response.response = [encoded]
    return response


if __name__ == '__main__':
    app.run()
