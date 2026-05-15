import dataclasses
import json
import logging
import os
import re
import subprocess
import time
from datetime import datetime, UTC, timedelta
from typing import Any, Union

import cachetools.func
import requests
from dateutil import parser
from fastapi.encoders import jsonable_encoder
from pony.orm import db_session, select, commit

import AltiusManager
from database import Images, Users, Games, Clips, Umpires
from utils import time_to_int, int_to_time, format_iso

with open('./resources/liveHockeyDefault.json', 'r') as f:
    default_details: dict[str, str] = json.load(f)

ADDRESS = os.environ['ADDRESS']

logger = logging.Logger('LiveHockeyManager')


@dataclasses.dataclass
class Clip:
    timecode: str
    length: str
    name: str
    link: str | None = None
    comment: str | None = None


@dataclasses.dataclass
class Game:
    blob: str
    team_one: str
    team_two: str
    team_one_long_name: str
    team_two_long_name: str
    team_one_image: str
    team_two_image: str
    competition_name: str
    start_time: int
    last_server_ping: int
    is_live: bool
    altius_link: str | None = None
    teamstar_link: str | None = None
    official_one: AltiusManager.Official | None = None
    official_two: AltiusManager.Official | None = None

    @db_session
    def save_to_db(self):
        d = dataclasses.asdict(self)
        if self.official_one is not None:
            d['official_one'] = Umpires.get(name=d['official_one']['name'])
        if self.official_two is not None:
            d['official_two'] = Umpires.get(name=d['official_two']['name'])
        return Games(**d)


def _convert_comp_name(comp):
    comp = re.sub('^WA J?', '', comp)
    comp = re.sub('DIVISION', 'Div', comp, flags=re.IGNORECASE)
    comp = re.sub('Premier League -', 'Prem One', comp, flags=re.IGNORECASE)
    comp = re.sub(r'Premier div 2 -', r'Prem Two', comp, flags=re.IGNORECASE)
    comp = re.sub(r'Premier div 3 -', r'Prem Three', comp, flags=re.IGNORECASE)
    comp = re.sub('DIV', 'Div', comp)
    comp = re.sub('MEN', 'Men', comp, flags=re.IGNORECASE)
    comp = re.sub('WOMEN', 'Women', comp, flags=re.IGNORECASE)
    comp = re.sub('RB Pennant -', 'Rae Blunt', comp)
    comp = re.sub(r'B(\d+)', r'Div \1 Boys', comp)
    comp = re.sub(r'G(\d+)', r'Div \1 Girls', comp)
    comp = re.sub('[()]', '', comp)
    comp = re.sub('div div', 'div', comp, flags=re.IGNORECASE)

    return comp


_COMPS_TO_ALTIUS_ID = {
    'Prem One Men': 57,
    'Prem One Women': 58,
    'Prem Two Men': 59,
    'Prem Two Women': 60,
}

_LIVEHOCKEY_CODE_TO_ALTIUS_CODE = {i: i for i in AltiusManager.NAME_TO_CODE.values()} | {
    'FRE': 'FCHC',
    'FCH': 'FCHC',
    'WHC': 'WHIT',
    'WHI': 'WHIT',
    'WSP': 'WASPS',
    'WAS': 'WASPS',
    'CUR': 'CUHC',
    'RAI': 'NCR',
    'RED': 'REDS',
    'VIC': 'VPX',
    'MOD': 'MOGM',
    'MOG': 'MOGM',
    'NEW': 'NKHC',
    'NKH': 'NKHC',
    'SUB': 'LIONS',
    'LIO': 'LIONS',
    'YMC': 'YMCC'
}


def live_hockey_game_to_db_game(game: dict[str, Any], use_stream_time=True, fix_for_js=False) -> Game | dict:
    stream_start = game.get('streamStart', None)
    comp_name = _convert_comp_name(game['competition']['playerLevel']['name'])
    team_one_code = game['homeTeam']['shortName']
    team_two_code = game['awayTeam']['shortName']
    out = Game(
        blob=game['id'],
        is_live=game.get('live', False),
        competition_name=comp_name,
        team_one=team_one_code,
        team_two=team_two_code,
        team_one_long_name=game['homeTeam']['longName'],
        team_two_long_name=game['awayTeam']['longName'],
        team_one_image=get_image_for_team(game['homeTeam']),
        team_two_image=get_image_for_team(game['awayTeam']),
        start_time=round(parser.parse(stream_start if use_stream_time and stream_start else game['start']).timestamp()),
        last_server_ping=round(time.time()),
        altius_link=f'https://hockeywa.altiusrt.com/matches/{game["extId"]}' if game['extSrc'] == 'ALT_WA' else None,
        teamstar_link=f'https://comp.teamstar.team/event/${game["extId"]}' if game['extSrc'] == 'TEAMSTAR' else None,
    )
    if comp_name in _COMPS_TO_ALTIUS_ID and game['extSrc'] == 'ALT_WA':
        team_one_code = _LIVEHOCKEY_CODE_TO_ALTIUS_CODE[team_one_code]
        team_two_code = _LIVEHOCKEY_CODE_TO_ALTIUS_CODE[team_two_code]
        altius_games = AltiusManager.get_appointments(tournaments=(_COMPS_TO_ALTIUS_ID[comp_name],))
        # if the games are of the same two teams, and start within and hour of eachother, they are probably the correct game
        TWO_HOURS = 2 * 60 * 60
        start_time = parser.parse(game['start']).timestamp()
        altius_game = ([i for i in altius_games if
                        team_one_code in i.teams and team_two_code in i.teams and abs(i.start_time / 1000 - start_time) < TWO_HOURS] + [
                           None])[0]
        if altius_game:
            print(altius_game.umpires)
            [out.official_one, out.official_two] = [AltiusManager.get_officials()[i] for i in altius_game.umpires]
        else:
            out.official_one = None
            out.official_two = None
    if fix_for_js:
        out = fix_game_for_js(out)
    return out


def fix_game_for_js(game: Union[Game | Games | dict]) -> dict:
    if isinstance(game, Games):
        game = game.to_dict()
        game['official_one'] = jsonable_encoder(
            next(i for i in AltiusManager.get_officials().values() if i.id == game['official_one']))
        game['official_two'] = jsonable_encoder(
            next(i for i in AltiusManager.get_officials().values() if i.id == game['official_two']))
    else:
        game = jsonable_encoder(game)
    if game.get('official_one', False) and game.get('official_two', False):
        game['officials'] = [i for i in [game['official_one']['name'], game['official_two']['name']] if i]
        del game['official_two']
    else:
        game['officials'] = []
    for i in ['one', 'two']:
        if f'official_{i}' in game:
            del game[f'official_{i}']

    game['start_time'] *= 1000
    game['last_server_ping'] *= 1000
    return game


def fix_clip_for_js(clip: Union[Clip, Clips]) -> dict:
    if isinstance(clip, Clips):
        clip = clip.to_dict()
        clip['timecode'] = clip['start_time']
        clip['length'] = clip['duration']
        del clip['start_time']
        del clip['duration']
    else:
        clip = jsonable_encoder(clip)
    clip['length'] = int_to_time(clip['length'])
    clip['timecode'] = int_to_time(clip['timecode'])
    return clip


def get_games_from_comps(comps, count=16, include_live=True):
    params = []
    for comp in comps:
        params.append(('competition-id', comp['id']))
    params += [
        ('page-index', '0'),
        ('page-size', str(count)),
        ('include-live', 'true' if include_live else 'false'),
        ('sort-column', 'start'),
    ]
    return f'https://api.livearenasports.com/broadcast/', params


@db_session
def get_image_for_team(team: dict[str, Any]) -> str:
    images = {i.name: i.link for i in select(i for i in Images)}

    if team.get('logo', None) is not None:
        # team[logo] is a dict
        link = f'https://files.livearenasports.com/files/{team['logo']['blobId']}'
        if team['shortName'] not in images:
            Images(name=team['shortName'], link=link)
            commit()
        return link
    elif team['shortName'] in images:
        return images[team['shortName']]
    else:
        return 'https://files.livearenasports.com/files/33e72f46-b1e5-48de-a411-14bf28de0b5c'


@db_session
def _db_get_live_hockey_token(username):
    if not username: return None
    user = Users.get(username=username)
    if not user: return None
    return user.token


@db_session
def _db_set_live_hockey_token(username, token):
    Users(username=username, token=token)


def _web_get_live_hockey_token(username, password):
    response = requests.post(
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
    return token


def get_link_from_blob(blob: str, username=None,
                       password=None) -> str:
    username = username or default_details['username']
    password = password or default_details['password']
    token = _db_get_live_hockey_token(username)
    if not token:
        token = _web_get_live_hockey_token(username, password)
        _db_set_live_hockey_token(username, token)
    try:
        out = requests.get(f'https://api.livearenasports.com/broadcast/video/{blob}?video-format=HLS',
                           headers={'Authorization': f'Bearer {token}', 'site-id': 'AU_FH_AUS'}).json()['videoUrl']
        return out
    except requests.exceptions.RequestException:
        token = _web_get_live_hockey_token(username, password)
        out = requests.get(f'https://api.livearenasports.com/broadcast/video/{blob}?video-format=HLS',
                           headers={'Authorization': f'Bearer {token}', 'site-id': 'AU_FH_AUS'}).json()['videoUrl']
        return out


def download_clip_for_game(
        blob: str,
        clip: Clip,
        quality: int,
        username: str = None,
        password: str = None
):
    output_clip = dataclasses.replace(clip)
    index_url = get_link_from_blob(blob, username, password)
    os.makedirs(f'/videos/output/{blob}', exist_ok=True)
    output_location = f'/videos/output/{blob}/{clip.name}.mp4'
    args: list[str] = [
        "ffmpeg",
        "-y",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-ss", str(max(time_to_int(clip.timecode) - 12, 0)),
        "-live_start_index", "0",
        "-i", index_url,
        '-avoid_negative_ts', 'make_zero',
        "-ss", '10',
        "-t", str(time_to_int(clip.length) + 4),
        "-c:v", "libx264",
        "-c:a", "flac",
        "-preset", "veryfast",
        "-r", "30",
        "-crf", f'{40 - 2 * quality}',
        "-af", "aresample=async=1000",
        "-f", "mp4",
        output_location
    ]
    process = subprocess.Popen(args, stdout=subprocess.PIPE, bufsize=1, text=True)
    for line in process.stdout:
        print(line)

    return_code = process.wait(120)
    if return_code != 0:
        return None

    output_clip.link = f'{ADDRESS}/api/clips/{blob}/{clip.name}.mp4'
    return output_clip


def main():
    print(download_clip_for_game('69edabc3ea763622a3811683', Clip('0', '0', 'test'), 3))


def get_recent_games(location: str = 'hockeywa', juniors: bool = False, premier_only: bool = False,
                     masters: bool = False):
    key = (location, juniors, premier_only, masters)
    current_timestamp = datetime.now(UTC).timestamp()
    update_required_timestamp, out = get_recent_games.RECENT_GAMES_RESPONSES.get(key, (0, None))
    if current_timestamp < update_required_timestamp:
        return out
    this_year = str(datetime.now().year)
    structure = requests.get(
        f'https://api.livearenasports.com/site/structure',
        params={'slug': f'live{location}'},
        headers={'site-id': 'AU_FH_AUS'},
    ).json()
    competitions = structure[0]['competitions']

    def comp_filter(comp):
        if comp.get('hidden', False): return False
        name = comp['name']
        if this_year not in name:
            return False
        if premier_only:
            if juniors and re.search(r'WA J ((9/10)|(11/12)) Division 1', name):
                return True
            return 'premier' in name.lower()
        else:
            output = True
            if not masters:
                output &= not re.search(r'WA ((Rae Blunt)|(O\d{2}))', name)
            if not juniors:
                output &= not re.search(r'WA J \d{1,2}/\d{1,2}', name)
            return output

    comps = [c for c in competitions if comp_filter(c)]
    now = datetime.now(UTC)
    date_to = now + timedelta(days=4)
    one_week_ago = now - timedelta(days=4)
    # Upcoming games
    future_base, future_params = get_games_from_comps(comps, 8, include_live=True)
    future_params += [
        ('sort-order', 'Ascending'),
        ('start-from', format_iso(now)),
        ('start-to', format_iso(date_to)),
    ]
    upcoming_raw = requests.get(future_base, params=future_params, headers={'site-id': 'AU_FH_AUS'})
    upcoming_raw = upcoming_raw.json()
    upcoming = [live_hockey_game_to_db_game(g, False, True) for g in upcoming_raw]
    # Recent games
    past_base, past_params = get_games_from_comps(comps, 8, include_live=False)
    past_params += [
        ('sort-order', 'Descending'),
        ('start-to', format_iso(now)),
        ('start-from', format_iso(one_week_ago)),
    ]
    recent_raw = requests.get(past_base, params=past_params, headers={'site-id': 'AU_FH_AUS'}).json()
    recent = [live_hockey_game_to_db_game(g, False, True) for g in recent_raw]
    update_required_timestamp = min([i["start_time"] / 1000 for i in upcoming] + [date_to.timestamp()])
    get_recent_games.RECENT_GAMES_RESPONSES[key] = (update_required_timestamp, (recent, upcoming))
    return recent, upcoming


get_recent_games.RECENT_GAMES_RESPONSES = {}
