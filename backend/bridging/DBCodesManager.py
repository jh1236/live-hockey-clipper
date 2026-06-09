import logging
import os
import re
from typing import Literal

from pony.orm import db_session

from database import Clubs, init_db, Officials

logger = logging.Logger(__name__)

_FIX_ALTIUS_CODE = {
    'HAL': 'HAL',
    'VPX': 'VPX',
    'CUHC': 'CUHC',
    'WOL': 'WOL',
    'YMCC': 'YMCC',
    'REDS': 'REDS',
    'SUBS': 'SUBS',
    'WASPS': 'WASPS',
    'UWA': 'UWA',
    'MEL': 'MEL',
    'WHIT': 'WHIT',
    'NCR': 'NCR',
    'FCHC': 'FCHC',
    'NKHC': 'NKHC',
    'MOGM': 'MOGM',
    'WOLVES': 'WOL',
    'WHC': 'WHIT',
    'LIONS': 'SUBS',
    'RDHC': 'RDHC',
    'WSP': 'WASPS',
    'OA': 'REDS',
    'CUH': 'CUHC',
    'LION': 'SUBS',
    'HALE': 'HAL',
    'OGM': 'OGMHC',
    'FRE': 'FCHC',
    'YM': 'YMCC',
    'OGMHC': 'OGMHC',
    'MODS': 'MODS',
    'WOLV': 'WOL',
    'MELV': 'MEL',
    'SOU': 'SOU'
}

_FIX_LIVE_HOCKEY_CODE = _FIX_ALTIUS_CODE | {
    'FRE': 'FCHC',
    'FCH': 'FCHC',
    'WHC': 'WHIT',
    'WHI': 'WHIT',
    'WSP': 'WASPS',
    'WAS': 'WASPS',
    'CUR': 'CUHC',
    'CUH': 'CUHC',
    'RAI': 'NCR',
    'RED': 'REDS',
    'VIC': 'VPX',
    'MOD': 'MOGM',
    'GUI': 'MOGM',
    'MOG': 'MOGM',
    'NEW': 'NKHC',
    'NKH': 'NKHC',
    'SUB': 'SUBS',
    'LIO': 'SUBS',
    'YMC': 'YMCC',
    'ROC': 'RDHC',
}


def name_to_code(name):
    NAME_TO_CODE = {
        'hale': 'HAL',
        'vic': 'VPX',
        'curtin': 'CUHC',
        'wolves': 'WOL',
        'ymcc': 'YMCC',
        'ymca': 'YMCC',
        'reds': 'REDS',
        'aquin': 'REDS',
        'sub': 'SUBS',
        'lions': 'SUBS',
        'wasp': 'WASPS',
        'wesley': 'WASPS',
        'uwa': 'UWA',
        'western australia': 'UWA',
        'university of wa': 'UWA',
        'melville': 'MEL',
        'whitford': 'WHIT',
        'raiders': 'NCR',
        'fremantle': 'FCHC',
        'freo': 'FCHC',
        'newman': 'NKHC',
        'modernians': 'MODS',
        'ogm': 'OGMHC',
        'guildford': 'OGMHC',
        'rockingham': 'RDHC',
        'sthn river': 'SOU',
        'southern river': 'SOU'
    }
    name = name.lower()
    if ('mods' in name or 'modernians' in name) and ('ogm' in name or 'guildford' in name):
        # check to ensure that we can match mods-guildford properly 
        # (because they have merged, they need to be handled specially)
        return 'MOGM'
    for i in NAME_TO_CODE:
        if i in name:
            return NAME_TO_CODE[i]
    clubs = Clubs.select()
    for club in clubs:
        if club.long_name.lower() == name:
            return club.code
    logging.warning('Unknown team name: %s', name)
    return None


def venue_name_to_code(name):
    NAME_TO_CODE = {
        r'hale': 'HALE',
        r'pulse': 'MELV',
        r'melville': 'MELV',
        r'melv-': 'MELV',
        r'lemnos': 'LEM',
        r'shenton': 'LEM',
        r'lem-': 'LEM',
        r'perth hockey': 'PHS',
        r'perht hockey': 'PHS',  # the good people of HWA can not spell
        r'phs': 'PHS',
        r'guildford': 'GUILD',
        r'ogm-t': 'GUILD',
        r'troy': 'TPHC',
        r'whit': 'TPHC',
        r'whc-': 'TPHC',
        r'warwick': 'TPHC',
        r'lakeland': 'LAKE',
        r'uwa': 'UWA',
        r'super': 'UWA',
        r'aquin': 'AQUIN',
        r'lark': 'ROCK',
        r'rock': 'ROCK',
        r'dayton': 'DAYT',
        r'joondalup': 'JOO',
        r'toro': 'SOR',
        r'southern\briver': 'SOR',

        # regional associations
        r'goldfields': 'EGHA',
        r'northam': 'NRTHM',
        r'busselton': 'BHA',
        r'geraldton': 'GHA',
        r'bunbury': 'BDHA',
        r'narrogin': 'NRLC',
    }
    name = name.lower()
    for i in NAME_TO_CODE:
        if re.search(i, name):
            return NAME_TO_CODE[i]
    raise Exception(f'Unknown venue {name}')


def team_code_to_name(code):
    with db_session():
        team = Clubs.get(code=code)
        if team is None:
            logger.error(f'Team {code} not found')
            return None
        return team.long_name


def _fix_altius_code(code: str) -> str:
    if code in _FIX_ALTIUS_CODE:
        return _FIX_ALTIUS_CODE[code]
    logging.warning(f'Altius returned unknown code {code}')
    return code


def _fix_live_hockey_code(code: str, long_name) -> str:
    if code.upper() in _FIX_LIVE_HOCKEY_CODE:
        code = _FIX_LIVE_HOCKEY_CODE[code]
    else:
        converted = name_to_code(long_name)
        if converted:
            logging.warning("code '%s' appears to be for team %s, but it is not mapped so", code,
                            team_code_to_name(converted))
    return code


def fix_code(code: str, source: Literal['altius'] | Literal['live_hockey'] | Literal['whistle_iq'], *,
             name_for_diagnostic=None):
    code = re.sub(r'\d', '', code)  # some altius codes have a trailing number for 2nd div sides.
    code = code.upper()
    match source:
        case 'altius':
            return _fix_altius_code(code)
        case 'live_hockey':
            return _fix_live_hockey_code(code, name_for_diagnostic)
        case 'whistle_iq':
            pass


def fix_human_name(name: str):
    first_name_fixes = {
        'Matt': 'Matthew',
        'Lachie': 'Lachlan',
        'Will': 'William',
        'Jess': 'Jessica',
        'Ben': 'Benjamin',
        'John': 'Johnathon',
        'Dan': 'Daniel',
        'Tom': 'Thomas',
        'Dave': 'David',
        'Deb': 'Deborah',
        'Joe': 'Joseph',
        'Josh': 'Joshua',
        'Mel': 'Melissa',
        'Sam': 'Samuel'
    }
    first_name, last_name = name.split(' ', 1)
    if first_name in first_name_fixes:
        first_name = first_name_fixes[first_name]
    return f'{first_name} {last_name}'.title()


if __name__ == '__main__':
    os.environ['DATABASE_PATH'] = '../resources/database.db'
    init_db()
    with db_session():
        for i in Officials.select():
            i.name = fix_human_name(i.name)
