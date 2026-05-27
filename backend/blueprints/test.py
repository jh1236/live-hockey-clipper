from quart import request
from quart.blueprints import Blueprint

test_bp = Blueprint('test_bp', __name__, url_prefix='/test')


@test_bp.get('/')
async def favourite_clip():
    return dict(request.args)
