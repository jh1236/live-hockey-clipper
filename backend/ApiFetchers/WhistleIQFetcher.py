from getuseragent import UserAgent
from httpx import HTTPError
from pony.orm import db_session

from bridging import DatabaseAligner
from bridging.DatabaseAligner import get_or_create_user
from config import get_config
from database import Competitions
from requester import client

HOCKEY_WA_ORG = "73C71E631121467FBF7CA63043321HWA"


def get_header():
    return {
        'Host': 'app.whistleiq.com',
        'Origin': 'https://app.whistleiq.com',
        'Referer': 'https://app.whistleiq.com',
        'User-Agent': UserAgent().Random(),
    }


DEFAULT_FORM_DATA = {
    'appVersion': 'v2.0.0',
    'platform': 'web',
    "origin": 'https://app.whistleiq.com'
}


async def get_session(username=None, *, force_refresh=False):
    username = username or get_config().whistle_iq_username
    with db_session():
        user = DatabaseAligner.get_or_create_user(username=username)
        if not force_refresh and user and user.whistle_iq_session:
            return user.whistle_iq_session


        response = await client.get('https://app.whistleiq.com/', headers=get_header())
        session_id = response.cookies.get('PHPSESSID')
        user.whistle_iq_session = session_id
        return session_id


async def get_cookies(username=None, password=None, *, force_refresh=False):
    username = username or get_config().whistle_iq_username
    password = password or get_config().whistle_iq_password
    with db_session():
        user = get_or_create_user(username=username)
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
                                      cookies=cookies, headers=get_header())).json()
            token = resp['token']
            user.whistle_iq_token = token
            return cookies | {'token': token}
        except HTTPError as e:
            if force_refresh:
                raise e
            else:
                return get_cookies(username, password, force_refresh=True)


async def make_request(payload, username=None, password=None, *, force_refresh=False):
    cookies = await get_cookies(username, password)
    try:
        form_data = DEFAULT_FORM_DATA | {'token': cookies['token']}
        form_data |= payload
        resp = \
            await client.post("https://app.whistleiq.com/v2.0.0/api/app/data/", data=form_data, cookies=cookies,
                              headers=get_header())
        resp.raise_for_status()
        return resp.json()
    except HTTPError as e:
        if force_refresh:
            raise e
        else:
            return await make_request(username, password, payload, force_refresh=True)


async def get_events(username=None, password=None) -> list[dict]:
    org_data = await make_request({
        'context': 'getDataForOrganization',
        'orgGuid': HOCKEY_WA_ORG,
    }, username=username, password=password)
    return org_data['events']


async def get_event_games(username, password, comp: Competitions) -> dict:
    org_data = await make_request(username, password, {
        'includeExtendedData': '1',
        'eventGuid': comp.whistle_iq_id,
    })
    return org_data['fixtures']
