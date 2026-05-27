"""
It's getting serious - we have the pydoc now

This file is responsible for allowing unified editing of the database independent of where the data came from.
It does this by using 'codes' which are short, three-to-six letter codes that represent venues and teams.
"""

import re
from typing import Literal

from pony.orm import db_session, select

from bridging import DBCodesManager
from database import Clubs, Games, Competitions, Officials, Venues, Users

THIRTY_MINUTES = 30 * 60


@db_session
def get_or_create_game(home_team_code: str, away_team_code: str, start_time: float, competition: Competitions, *,
                       home_team_long_name: str = None, away_team_long_name: str = None) -> Games:
    team_one = get_or_create_team(home_team_code, long_name_if_new=home_team_long_name)
    team_two = get_or_create_team(away_team_code, long_name_if_new=away_team_long_name)
    games = list(select(i for i in Games if i.home_team == team_one and i.away_team == team_two and abs(
        i.start_time - start_time) < THIRTY_MINUTES and i.competition == competition))
    if len(games) > 1:
        raise Exception('Two Games found!')
    elif len(games) == 1:
        return games[0]
    else:
        return Games(home_team=team_one, away_team=team_two, start_time=round(start_time), competition=competition)


@db_session
def get_or_create_comp(year: int, level: str, gender: str, ) -> Competitions:
    comp = Competitions.get(level=level, gender=gender, year=year)
    if comp:
        return comp
    else:
        if level.lower().startswith('o'):
            age = 'Masters'
        elif level[0].isdigit():
            age = 'Juniors'
        else:
            age = 'Seniors'
        premier = bool(level.lower().startswith('p') or re.search(r'[90]/[1]\d div one', level.lower()))
        comp = Competitions(level=level, gender=gender, year=year, age_level=age, is_premier=premier)
        return comp


@db_session
def get_or_create_official(name: str, *, gender_if_new: Literal['M'] | Literal['F'] | None = None,
                           role_if_new: str | None = None) -> Officials:
    official = Officials.get(name=name)
    if official:
        if official.gender == '?' and gender_if_new:
            official.gender = gender_if_new
        if not official.role and role_if_new or official.role in ['Technical Official',
                                                                  'Tech Official'] and role_if_new == 'Umpire':
            official.role = role_if_new
        return official
    else:
        official = Officials(name=name, gender='?' if not gender_if_new else gender_if_new)
        return official


@db_session
def get_or_create_team(code: str, *, long_name_if_new=None) -> Clubs:
    team = Clubs.get(code=code)
    if team:
        if not team.long_name and long_name_if_new:
            team.long_name = long_name_if_new
        return team
    else:
        team = Clubs(code=code, long_name=long_name_if_new or DBCodesManager.team_code_to_name(code))
        return team


@db_session
def get_or_create_venue(code: str, turf_number, *, long_name_if_new=None) -> Venues:
    venue = Venues.get(code=code, turf_number=turf_number)
    if venue:
        return venue
    else:
        venue = Venues(code=code, turf_number=turf_number, long_name=long_name_if_new)
        return venue


@db_session
def get_or_create_user(username: str) -> Users:
    user = Users.get(username=username)
    if user:
        return user
    else:
        user = Users(username=username)
        return user
