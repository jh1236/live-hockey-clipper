from datetime import datetime

from fastapi.encoders import jsonable_encoder
from quart import Blueprint, jsonify, request

from AltiusManager import get_ladder, get_appointments, YEAR_TO_TOURNAMENT_ID

appointments_bp = Blueprint('appointments_bp', __name__, url_prefix='/appointments')


@appointments_bp.route('/ladder')
async def ladder():  # put application's code here
    year = request.args.get('year', str(datetime.now().year))
    return await get_ladder(year=year)


@appointments_bp.route('/available')
async def get_available():
    return jsonify({k: list(v.keys()) for k, v in YEAR_TO_TOURNAMENT_ID.items()})


@appointments_bp.route('/')
async def get_appointments_web():  # put application's code here
    year = request.args.get('year', str(datetime.now().year))
    return jsonify(jsonable_encoder(await get_appointments(year=year)))
