import dataclasses
import os


@dataclasses.dataclass
class Config:
    cache_folder: str = './cache'
    videos_folder: str = './videos'
    database_path: str = './resources/database.db'
    server_address: str = 'http://localhost:5000'
    live_hockey_username: str | None = None
    live_hockey_password: str | None = None


def get_config() -> Config:
    args = {
        'cache_folder': os.environ.get('CACHE_DIRECTORY', None),
        'videos_folder': os.environ.get('VIDEO_DIRECTORY', None),
        'database_path': os.environ.get('DATABASE_PATH', None),
        'live_hockey_username': os.environ.get('LIVE_HOCKEY_USER', None),
        'live_hockey_password': os.environ.get('LIVE_HOCKEY_PWD', None),
        'server_address': os.environ.get('ADDRESS', None),
    }
    args = {k: v for k, v in args.items() if v}
    return Config(**args)
