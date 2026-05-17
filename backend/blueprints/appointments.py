from datetime import datetime

from fastapi.encoders import jsonable_encoder
from flask import Blueprint, jsonify, request

from AltiusManager import get_ladder, get_appointments, get_officials, YEAR_TO_TOURNAMENT_ID

appointments_bp = Blueprint('appointments_bp', __name__, url_prefix='/appointments')


@appointments_bp.route('/ladder')
def ladder():  # put application's code here
    year = request.args.get('year', datetime.now().year)
    return get_ladder(year=year)


@appointments_bp.route('/available')
def get_available():
    return jsonify({k: list(v.keys()) for k, v in YEAR_TO_TOURNAMENT_ID.items()})


@appointments_bp.route('/')
def get_appointments_web():  # put application's code here
    year = request.args.get('year', datetime.now().year)
    return jsonify(jsonable_encoder(get_appointments(year=year)))
