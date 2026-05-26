from collections import defaultdict

from httpx import HTTPError
from pony.orm import db_session

from database import Users
from requester import client
from utils import NUMBERS

HOCKEY_WA_ORG = "73C71E631121467FBF7CA63043321HWA"
DEFAULT_HEADERS = {
    'Host': 'app.whistleiq.com',
    'Origin': 'https://app.whistleiq.com',
    'Referer': 'https://app.whistleiq.com',
}
DEFAULT_FORM_DATA = {
    'appVersion': 'v2.0.0',
    'platform': 'web',
    "origin": 'https://app.whistleiq.com'
}


SENIOR_GRADES = [f'Prem {NUMBERS[i + 1]} {gender}' for gender in ['Men', 'Women'] for i in range(3)]
JUNIOR_GRADES = [f'{grade} Div 1 {gender}' for gender in ['Boys', 'Girls'] for grade in ['9/10', '11/12']]
GRADES = SENIOR_GRADES + JUNIOR_GRADES


async def get_session(username, *, force_refresh=False):
    with db_session():
        user = Users.get(username=username)
        if not force_refresh and user and user.whistle_iq_session:
            return user.whistle_iq_session

        if user is None:
            user = Users(username=username)
        response = await client.get('https://app.whistleiq.com/', headers=DEFAULT_HEADERS)
        session_id = response.cookies.get('PHPSESSID')
        user.whistle_iq_session = session_id
        return session_id


async def get_cookies(username, password, *, force_refresh=False):
    with db_session():
        user = Users.get(username=username)
        cookies = {'PHPSESSID': await get_session(username, force_refresh=force_refresh)}
        if not force_refresh and user and user.whistle_iq_token:
            return cookies | {'token': user.whistle_iq_token}
        form_data = DEFAULT_FORM_DATA | {
            'context': 'getSignInToken',
            'email': username,
            'password': password,
        }
        try:
            resp = (await client.post("https://app.whistleiq.com/v2.0.0/api/app/getApiToken/", data=form_data,
                                      cookies=cookies, headers=DEFAULT_HEADERS)).json()
            token = resp['token']
            if user is None:
                user = Users(username=username)
            user.whistle_iq_token = token
            return cookies | {'token': token}
        except HTTPError as e:
            if force_refresh:
                raise e
            else:
                return get_cookies(username, password, force_refresh=True)


async def make_request(username, password, payload, *, force_refresh=False):
    cookies = await get_cookies(username, password)
    try:
        form_data = DEFAULT_FORM_DATA | {'token': cookies['token']}
        form_data |= payload
        resp = \
            await client.post("https://app.whistleiq.com/v2.0.0/api/app/data/", data=form_data, cookies=cookies,
                              headers=DEFAULT_HEADERS)
        resp.raise_for_status()
        return resp.json()
    except HTTPError as e:
        if force_refresh:
            raise e
        else:
            return await make_request(username, password, payload, force_refresh=True)


async def get_events(username, password) -> dict:
    org_data = await make_request(username, password, {
        'context': 'getDataForOrganization',
        'orgGuid': HOCKEY_WA_ORG,
    })
    return org_data['events']

async def get_event_games(username, password, event_id) -> dict:
    org_data = await make_request(username, password, {
        'includeExtendedData': '1',
        'eventGuid': event_id,
    })
    return org_data['fixtures']


async def _add_event_games_to_dict(username, password, event, appointments_dict):
    year = int(event['startDateSql'].split('-')[0])
    games = await get_event_games(username, password, event['eventGuid'])
    for game in games:
        game_to_add = None

async def get_appointments(username, password):
    events = await get_events(username, password)
    years = defaultdict(lambda: {i: [] for i in GRADES})
    for i in events:
        year = int(i['startDateSql'].split('-')[0])
        
    return years
