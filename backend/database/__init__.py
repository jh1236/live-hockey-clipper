import os
from datetime import datetime

from pony.orm import Database, PrimaryKey, Required, Optional, Set, composite_key

from config import get_config
from utils import int_to_time

db = Database()


def init_db():
    path = os.path.abspath(get_config().database_path)
    db.bind(provider='sqlite', filename=path, create_db=True)
    db.generate_mapping(create_tables=False)


def NullableOptional(a, *args, **kwargs):
    return Optional(a, nullable=True, *args, **kwargs)


class Umpires(db.Entity):
    id = PrimaryKey(int, auto=True)
    name = Required(str, unique=True)
    gender = Required(str)
    time_created = NullableOptional(int)
    games_first_official = Set('Games', reverse='official_one')
    games_second_official = Set('Games', reverse='official_two')


class Clubs(db.Entity):
    id = PrimaryKey(int, auto=True)
    code = Required(str, unique=True)
    long_name = Required(str)
    image_link = NullableOptional(str)
    time_created = NullableOptional(int)
    home_games = Set('Games', reverse='home_team')
    away_games = Set('Games', reverse='away_team')


class Competitions(db.Entity):
    id = PrimaryKey(int, auto=True)
    level = Required(str)
    gender = Required(str)
    age_level = Required(str)
    is_premier = Required(bool)
    year = Required(int)
    altius_id = NullableOptional(int, unique=True)
    live_hockey_id = NullableOptional(str, unique=True)
    time_created = NullableOptional(int)
    games = Set('Games', reverse='competition')
    composite_key(gender, level, year)

class Venues(db.Entity):
    id = PrimaryKey(int, auto=True)
    code = Required(str)
    long_name = NullableOptional(str)
    turf_number = Required(int)
    time_created = NullableOptional(int)
    games = Set('Games', reverse='venue')
    composite_key(code, turf_number)

class Games(db.Entity):
    id = PrimaryKey(int, auto=True)
    home_team = Required(Clubs, column='home_team_id')
    away_team = Required(Clubs, column='away_team_id')
    start_time = Required(int)
    competition = Required(Competitions, column='competition_id')
    official_one = NullableOptional(Umpires, column='official_one_id')
    official_two = NullableOptional(Umpires, column='official_two_id')
    altius_id = NullableOptional(str, unique=True)
    teamstar_id = NullableOptional(str, unique=True)
    live_hockey_id = NullableOptional(str, unique=True)
    stream_start_time = NullableOptional(int)
    home_team_score = NullableOptional(int)
    away_team_score = NullableOptional(int)
    venue = NullableOptional(Venues, column='venue_id')
    time_created = NullableOptional(int)
    clips = Set('Clips', reverse='game')

    def format_for_frontend(self):
        game = self.to_dict()
        game['officials'] = []  
        if self.official_one:
            game['officials'].append(self.official_one.name)
        if self.official_two:
            game['officials'].append(self.official_two.name)
        del game['official_one']
        del game['official_two']
        game['competition'] = self.competition.to_dict()
        game['home_team'] = self.home_team.to_dict()
        game['away_team'] = self.away_team.to_dict()
        if self.venue:
            game['venue'] = self.venue.to_dict()
        game['start_time'] *= 1000
        if game.get('stream_start_time', None):
            game['stream_start_time'] *= 1000
        return game


class Clips(db.Entity):
    id = PrimaryKey(int, auto=True)
    game = Required(Games, column="game_id")
    name = Required(str)
    start_time = Required(int)
    duration = Required(int)
    link = NullableOptional(str)
    favourite = NullableOptional(bool)
    comment = NullableOptional(str)
    time_created = NullableOptional(int)

    def format_for_frontend(self):
        d = self.to_dict()
        d['game_blob'] = self.game.live_hockey_id
        d['start_time'] = int_to_time(self.start_time)
        d['duration'] = int_to_time(self.duration)
        d['categories'] = self.comment.split(';')
        del d['comment']
        return d


class Users(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str)
    live_hockey_token = NullableOptional(str)
    whistle_iq_token = NullableOptional(str)
    whistle_iq_session = NullableOptional(str)
