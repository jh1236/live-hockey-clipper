from datetime import datetime, UTC, timedelta

from pony.orm import db_session

from config import get_config
from database import Users, Competitions
from requester import client
from utils import format_iso

ADDRESS = get_config().server_address

TWO_HOURS = 2 * 60 * 60


def get_header(token: None | str = None):
    out = {
        'Host': 'api.livearenasports.com',
        'Referer': 'https://www.livehockey.com.au/',
        'site-id': 'AU_FH_AUS',
        'Origin': 'https://www.livehockey.com.au',
        'Content-Type': 'application/json',
    }
    if token:
        out['Authorization'] = 'Bearer ' + token
    return out


async def get_live_hockey_token(username, password, *, force_refresh=False):
    with db_session():
        user = Users.get(username=username)
        if not force_refresh and user and user.live_hockey_token:
            return user.live_hockey_token
        if user is None:
            user = Users(username=username)
        response = await client.post(
            "https://api.livearenasports.com/user/login",
            json={'userName': username, 'password': password},
            headers={
                'Content-Type': 'application/json',
                'site-id': 'AU_FH_AUS',
            }
        )
        response.raise_for_status()
        response = response.json()
        token = response.get('jwt_token', None)
        user.live_hockey_token = token
        return token


async def get_video_link_from_blob(blob: str, username=None,
                                   password=None, *, force_refresh=False) -> str:
    username = username or get_config().live_hockey_username
    password = password or get_config().live_hockey_password
    token = await get_live_hockey_token(username, password, force_refresh=force_refresh)
    try:
        out = (await client.get(f'https://api.livearenasports.com/broadcast/video/{blob}?video-format=HLS',
                                headers=get_header(token))).json()['videoUrl']
        return out
    except Exception as e:
        if force_refresh:
            raise e
        else:
            return await get_live_hockey_token(username, password, force_refresh=True)


async def get_game_from_live_hockey(blob):
    resp = await client.get(f'https://api.livearenasports.com/broadcast/{blob}',
                            headers=get_header())
    return resp.json()


async def get_games_from_live_hockey(competitions: list[Competitions], days_in_future: int, include_live: bool,
                                     from_date: int = None,
                                     page=1):
    from_date = datetime.fromtimestamp(from_date) if from_date else datetime.now(UTC)

    date_to = from_date + timedelta(days=days_in_future)
    # Upcoming games
    params = []
    args = {
        'competitionIds': [i.live_hockey_id for i in competitions],
        'includeLive': include_live,
        'pageIndex': page,
        'pageSize': 24,
        'sortColumn': 'start',
        'sortDirection': 'Ascending' if days_in_future > 0 else 'Descending',
        'startTo': format_iso(date_to),
        'startFrom': format_iso(from_date),
    }
    # Recent games
    try:
        games = (await client.post('https://api.livearenasports.com/broadcast/query', headers=get_header(),
                                   json=params)).json()
        games.raise_for_status()
        return games.json()
    except Exception as e:
        raise e
        return None


async def get_comps_from_live_hockey(location):
    structure = await client.get(
        f'https://api.livearenasports.com/site/structure?slug=live{location}',
        headers=get_header(),
    )
    structure = structure.json()
    competitions = structure[0]['competitions']
    return competitions
