from pony.orm import db_session
from quart import jsonify, request
from quart.blueprints import Blueprint

from database import Umpires

umpire_bp = Blueprint('umpire_bp', __name__, url_prefix='/umpires')


@umpire_bp.post('/set_gender')
async def update_umpire():
    with db_session():
        data = await request.json
        umpire = data['umpire']
        gender = data['gender']
        if gender not in ['M', 'F', '?']:
            return f'{gender} is not a valid gender', 400

        umpire = Umpires.get(name=umpire)

        if umpire is None:
            return 'Umpire not found', 404

        umpire.gender = gender

        return '', 204


@umpire_bp.route('/')
def get_umpires():
    with db_session():
        return jsonify({i.name: i for i in Umpires.select()})

# @umpire_bp.route('/db')
# def db():
#     return send_file('/database/database.db')
