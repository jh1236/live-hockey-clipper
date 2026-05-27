import dataclasses
import os


@dataclasses.dataclass
class Config:
    cache_folder: str = './cache'
    videos_folder: str = './videos'
    database_path: str = './resources/database.db'
    server_address: str = 'http://localhost:5000'
    run_altius_checks: bool | None = True
    cleanse_old_videos: bool | None = True
    live_hockey_username: str | None = None
    live_hockey_password: str | None = None
    whistle_iq_username: str | None = None
    whistle_iq_password: str | None = None


def get_config() -> Config:
    cleanse_videos = os.environ.get('REMOVE_STALE_CLIPS', None)
    check_altius = os.environ.get('CHECK_ALTIUS', None)

    if check_altius is not None and check_altius.lower() not in ['true', 'false']:
        raise ValueError('CHECK_ALTIUS must be true or false')
    if cleanse_videos is not None and check_altius.lower() not in ['true', 'false']:
        raise ValueError('REMOVE_STALE_CLIPS must be true or false')

    args = {
        'cache_folder': os.environ.get('CACHE_DIRECTORY', None),
        'videos_folder': os.environ.get('VIDEO_DIRECTORY', None),
        'database_path': os.environ.get('DATABASE_PATH', None),
        'live_hockey_username': os.environ.get('LIVE_HOCKEY_USER', None),
        'live_hockey_password': os.environ.get('LIVE_HOCKEY_PWD', None),
        'whistle_iq_username': os.environ.get('WHISTLE_IQ_USER', None),
        'whistle_iq_password': os.environ.get('WHISTLE_IQ_PWD', None),
        'server_address': os.environ.get('ADDRESS', None),
        'run_altius_checks': check_altius.lower() == 'true' if check_altius is not None else None,
        'cleanse_old_videos': cleanse_videos.lower() == 'true' if cleanse_videos is not None else None,
    }
    args = {k: v for k, v in args.items() if v is not None}
    return Config(**args)
