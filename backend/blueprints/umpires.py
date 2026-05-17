import os

import requests
from flask import jsonify, send_file, request, abort
from flask.blueprints import Blueprint
from pony.orm import select

import LiveHockeyManager
from AltiusManager import get_officials
from database import Games, Clips, Umpires
from utils import time_to_int

umpire_bp = Blueprint('umpire_bp', __name__, url_prefix='/umpires')


@umpire_bp.post('/set_gender')
def update_umpire():
    data = request.json
    umpire = data['umpire']
    gender = data['gender']
    if gender not in ['M', 'F', '?']:
        return f'{gender} is not a valid gender', 400

    umpire = Umpires.get(name=umpire)

    if umpire is None:
        return 'Umpire not found', 404

    umpire.gender = gender

    return '', 204


@umpire_bp.route('/genders')
def genders():
    return jsonify({k: v.gender for k, v in get_officials().items()})

@umpire_bp.route('/db')
def db():
    return send_file('/database/database.db')
