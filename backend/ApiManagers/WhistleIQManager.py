from pony.orm import db_session

from requester import client
from database import Users


async def get_whistle_iq_session(username):
    with db_session():
        user = Users.get(username=username)
        if user is None or user.whistle_iq_session is None:
            await client.get('https://app.whistleiq.com/')
            

async def _web_get_whistle_iq_token(username, password):
    form_data = {
        'context': 'getSignInToken',
        'appVersion': '2.0.0',
        'platform': 'web',
        
        'email': username,
        'password': password,
        
    }
    await client.post()