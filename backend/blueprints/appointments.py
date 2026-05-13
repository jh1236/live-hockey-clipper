from fastapi.encoders import jsonable_encoder
from flask import Blueprint, jsonify

from AltiusManager import get_ladder, get_appointments, get_officials

appointments_bp = Blueprint('appointments_bp', __name__, url_prefix='/appointments')


@appointments_bp.route('/ladder')
def ladder():  # put application's code here
    return get_ladder()


@appointments_bp.route('/')
def get_appointments_web():  # put application's code here
    return jsonify(jsonable_encoder(get_appointments()))


@appointments_bp.route('/genders')
def genders():  # put application's code here
    return jsonify({k: v.gender for k, v in get_officials().items()})
