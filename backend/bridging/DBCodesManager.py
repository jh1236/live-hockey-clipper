import logging
import re
from typing import Literal

from pony.orm import db_session

from database import Clubs

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
    'MELV': 'MEL'
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
    'MOG': 'MOGM',
    'NEW': 'NKHC',
    'NKH': 'NKHC',
    'SUB': 'LIONS',
    'LIO': 'LIONS',
    'YMC': 'YMCC',
    'ROC': 'RDHC',
}

_CODE_TO_NAME = {
    'HAL': 'Hale Hockey Club',
    'VPX': 'Vic Park Xavier Hockey Club',
    'CUHC': 'Curtin University Hockey Club',
    'WOL': 'Westside Wolves Hockey Club',
    'YMCC': 'YMCC Hockey Club',
    'REDS': 'Old Aquinians Hockey Club',
    'SUBS': 'Suburban Lions Hockey Club',
    'WASPS': 'Wesley South Perth Hockey Club',
    'UWA': 'Univeristy of Western Australia Hockey Club',
    'MEL': 'Melville City Hockey Club',
    'WHIT': 'Whitfords Hockey Club',
    'NCR': 'North Coast Raiders Hockey Club',
    'FCHC': 'Fremantle Cockburn Hockey Club',
    'NKHC': 'Newman Knights Hockey Club',
    'MODS': 'Modernians Hockey Club',
    'OGMHC': 'Modernians Old Guildford Mundaring Hockey Club',
    'RDHC': 'Rockingham District Hockey Club',
}


def prem_team_name_to_code(name):
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
        'newman': 'NKHC',
        'modernians': 'MODS',
        'ogm': 'OGMHC',
        'guildford': 'OGMHC',
        'rockingham': 'RDHC',
    }
    name = name.lower()
    if 'mods' in name and ('ogm' in name or 'guildford' in name):
        # check to ensure that we can match mods-guildford properly 
        # (because they have merged, they need to be handled specially)
        return 'MOGM'
    for i in NAME_TO_CODE:
        if i in name:
            return NAME_TO_CODE[i]
    return None


def venue_name_to_code(name):
    NAME_TO_CODE = {
        r'hale\W': 'HALE',
        r'pulse\W': 'MELV',
        r'melville\W': 'MELV',
        r'melv-': 'MELV',
        r'lemnos\W': 'LEM',
        r'lem-': 'LEM',
        r'perth hockey\W': 'PHS',
        r'perht hockey\W': 'PHS',  # the good people of HWA can not spell
        r'phs\W': 'PHS',
        r'guildford\W': 'GUILD',
        r'ogm-t': 'GUILD',
        r'troy\W': 'TPHC',
        r'whit': 'TPHC',
        r'whc-': 'TPHC',
        r'warwick\W': 'TPHC',
        r'lakeland': 'LAKE',
        r'uwa\W': 'UWA',
        r'super': 'UWA',
        r'aquin': 'AQUIN',
        r'lark\W': 'ROCK',
        r'rock\W': 'ROCK',

        # regional associations
        r'goldfields\W': 'EGHA',
        r'northam\W': 'NRTHM',
        r'busselton\W': 'BHA',
        r'geraldton\W': 'GHA',
        r'bunbury\W': 'BDHA',
        r'narrogin\W': 'UGSHA',
    }
    name = name.lower()
    for i in NAME_TO_CODE:
        if re.search(i, name):
            return NAME_TO_CODE[i]
    raise Exception(f'Unknown venue {name}')


def code_to_name(code):
    if code in _CODE_TO_NAME:
        return _CODE_TO_NAME[code]
    with db_session():
        team = Clubs.get(code=code)
        if team is None:
            raise Exception(f'Team {code} not found')
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
        converted = prem_team_name_to_code(long_name)
        if converted:
            logging.warning("code '%s' appears to be for team %s, but it is not mapped so", code,
                            code_to_name(converted))
    return code


def fix_code(code: str, source: Literal['altius'] | Literal['live_hockey'] | Literal['whistle_iq'], *,
             name_for_diagnostic=None):
    code = re.sub(r'\d', '', code)  # some altius codes have a trailing number for 2nd div sides.
    code = code.upper()
    match source:
        case 'altius':
            _fix_altius_code(code)
        case 'live_hockey':
            return _fix_live_hockey_code(code, name_for_diagnostic)
        case 'whistle_iq':
            pass
