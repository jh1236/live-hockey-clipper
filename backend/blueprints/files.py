import os

from pony.orm import db_session
from quart import Blueprint, request, send_file
from sanitize_filename import sanitize

from config import get_config
from database import Clips

files_bp = Blueprint('files', __name__, url_prefix='/files')


@files_bp.route('/clip/<clip_id>')
async def stream_file(clip_id):
    """Serve the video stream files"""
    with db_session():
        clip = Clips[int(clip_id)]
        download = request.args.get('download', 'false').lower() == 'true'
        directory = os.path.join(get_config().videos_folder, f'{clip.game.id}', sanitize(f'{clip.id}.mp4'))
        if download:
            name = f'{clip.game.name}{f'- {clip.name}' if not clip.name.startswith("Unsaved") else ''}.mp4'
            return await send_file(directory, as_attachment=True, attachment_filename=name)
        else:
            return await send_file(directory, as_attachment=False)


@files_bp.route('image/<image_name>')
async def image(image_name):
    """Serve the video stream files"""
    directory = os.path.join(get_config().images_folder, sanitize(image_name))
    return await send_file(directory, as_attachment=False)
