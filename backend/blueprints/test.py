import asyncio
import logging
import os

import humps
from pony.orm import select, db_session
from quart import jsonify, send_file, request
from quart.blueprints import Blueprint
from sanitize_filename import sanitize

from ApiManagers import LiveHockeyManager, altius_utils, ClipsManager, WhistleIQManager
from config import get_config
from database import Games, Clips
from requester import client

test_bp = Blueprint('test_bp', __name__, url_prefix='/test')


@test_bp.get('/')
async def favourite_clip():
    return {
        'test':
            await WhistleIQManager.get_events('healy_jared@yahoo.com', 'Jared')
    }
