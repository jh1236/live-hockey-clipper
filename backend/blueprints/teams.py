from pony.orm import db_session
from quart import jsonify, request
from quart.blueprints import Blueprint

from database import Officials, Clubs

team_bp = Blueprint('team_bp', __name__, url_prefix='/teams')


@team_bp.post('/set_image')
async def update_team():
    with db_session():
        data = await request.json
        team = data['team']
        image_link = data['imageLink']
        team = Clubs.get(code=team)

        if team is None:
            return 'Umpire not found', 404
    
        team.image_link = image_link
    
        return '', 204


@team_bp.route('/')
def get_teams():
    with db_session():
        return jsonify({i.code: i.format_for_frontend() for i in Clubs.select()})

# @umpire_bp.route('/db')
# def db():
#     return send_file('/database/database.db')
