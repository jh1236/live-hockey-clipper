from datetime import datetime

from pony.orm import db_session, select
from quart import Blueprint, jsonify, request

from ApiManagers import AltiusManager
from database import Competitions, Games

appointments_bp = Blueprint('appointments_bp', __name__, url_prefix='/appointments')


@appointments_bp.route('/ladder')
async def ladder():  # put application's code here
    year = request.args.get('year', str(datetime.now().year))
    return await AltiusManager.get_ladder(year=year)


@appointments_bp.route('/available')
async def get_available():
    with db_session():
        return jsonify([i.format_for_frontend() for i in select(i for i in Competitions if i.altius_id)])


@appointments_bp.route('/')
async def get_appointments_web():  # put application's code here
    with db_session():
        year = request.args.get('year', str(datetime.now().year))
        return jsonify([i.format_for_frontend() for i in select(i for i in Games if i.official_one and i.competition.year == year)])
