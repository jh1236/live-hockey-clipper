from quart import Blueprint

from blueprints.clips import clips_bp
from blueprints.appointments import appointments_bp
from blueprints.games import games_bp
from blueprints.test import test_bp
from blueprints.umpires import umpire_bp

api = Blueprint('api', __name__, url_prefix='/api')
api.register_blueprint(appointments_bp)
api.register_blueprint(clips_bp)
api.register_blueprint(umpire_bp)
api.register_blueprint(test_bp)
api.register_blueprint(games_bp)
