import os
from datetime import datetime

from pony.orm import Database, PrimaryKey, Required, Optional, Set, composite_key, db_session
from werkzeug.utils import send_file

from config import get_config
from utils import int_to_time

db = Database()


def init_db():
    path = os.path.abspath(get_config().database_path)
    db.bind(provider='sqlite', filename=path, create_db=True)
    db.generate_mapping(create_tables=False)


def NullableOptional(a, *args, **kwargs):
    return Optional(a, nullable=True, *args, **kwargs)


class Officials(db.Entity):
    id = PrimaryKey(int, auto=True)
    name = Required(str, unique=True)
    gender = Required(str)
    time_created = NullableOptional(int)
    panel = NullableOptional(str)
    role = NullableOptional(str)
    email = NullableOptional(str)
    phone_number = NullableOptional(str)

    games_first_umpire = Set('Games', reverse='umpire_one')
    games_second_umpire = Set('Games', reverse='umpire_two')
    games_reserve_umpire = Set('Games', reverse='reserve_umpire')
    games_tech_official = Set('Games', reverse='tech_official')
    games_scoring_judge = Set('Games', reverse='scoring_judge')
    games_timing_judge = Set('Games', reverse='timing_judge')
    games_umpire_manager = Set('Games', reverse='umpire_manager')

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        del d['phone_number']
        del d['email']
        return d


class Clubs(db.Entity):
    id = PrimaryKey(int, auto=True)
    code = Required(str, unique=True)
    long_name = NullableOptional(str)
    image_link = NullableOptional(str)
    time_created = NullableOptional(int)
    ladder_positions = Set('LadderPosition', reverse='team')

    home_games = Set('Games', reverse='home_team')
    away_games = Set('Games', reverse='away_team')

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        return d


class Competitions(db.Entity):
    id = PrimaryKey(int, auto=True)
    level = Required(str)
    gender = Required(str)
    age_level = Required(str)
    is_premier = Required(bool)
    year = Required(int)
    altius_id = NullableOptional(int, unique=True)
    live_hockey_id = NullableOptional(str, unique=True)
    whistle_iq_id = NullableOptional(str, unique=True)
    time_created = NullableOptional(int)

    games = Set('Games', reverse='competition')
    ladder = Set('LadderPosition', reverse='competition')
    composite_key(gender, level, year)

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        return d


class Venues(db.Entity):
    id = PrimaryKey(int, auto=True)
    code = Required(str)
    long_name = NullableOptional(str)
    turf_number = Required(int)
    time_created = NullableOptional(int)

    games = Set('Games', reverse='venue')
    composite_key(code, turf_number)

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        return d


class Games(db.Entity):
    id = PrimaryKey(int, auto=True)
    start_time = Required(int)
    altius_id = NullableOptional(int, unique=True)
    teamstar_id = NullableOptional(str, unique=True)
    live_hockey_id = NullableOptional(str, unique=True)
    stream_start_time = NullableOptional(int)
    home_team_score = NullableOptional(int)
    away_team_score = NullableOptional(int)
    complete = Required(bool, default=False)
    time_created = NullableOptional(int)
    source = NullableOptional(str)

    venue = NullableOptional(Venues, column='venue_id')
    home_team = Required(Clubs, column='home_team_id')
    away_team = Required(Clubs, column='away_team_id')
    competition = Required(Competitions, column='competition_id')
    umpire_one = NullableOptional(Officials, column='umpire_one_id')
    umpire_two = NullableOptional(Officials, column='umpire_two_id')
    reserve_umpire = NullableOptional(Officials, column='reserve_umpire_id')
    tech_official = NullableOptional(Officials, column='tech_official_id')
    scoring_judge = NullableOptional(Officials, column='scoring_judge_id')
    timing_judge = NullableOptional(Officials, column='timing_judge_id')
    umpire_manager = NullableOptional(Officials, column='umpire_manager_id')

    clips = Set('Clips', reverse='game')

    @property
    def name(self):
        return f'{self.competition.level} {"Men" if self.competition.gender == "M" else "Women"} - {self.home_team.code} v {self.away_team.code}'

    @db_session
    def format_for_frontend(self):
        game = self.to_dict()
        game['umpires'] = []
        if self.umpire_one:
            game['umpires'].append(self.umpire_one.format_for_frontend())
        if self.umpire_two:
            game['umpires'].append(self.umpire_two.format_for_frontend())
        if self.umpire_manager:
            game['umpire_manager'] = self.umpire_manager.format_for_frontend()
        if self.tech_official:
            game['tech_official'] = self.tech_official.format_for_frontend()
        del game['umpire_one']
        del game['umpire_two']
        del game['reserve_umpire']
        del game['timing_judge']
        del game['scoring_judge']
        game['competition'] = self.competition.format_for_frontend()
        game['home_team'] = self.home_team.format_for_frontend()
        game['away_team'] = self.away_team.format_for_frontend()
        if self.venue:
            game['venue'] = self.venue.format_for_frontend()
        game['start_time'] *= 1000
        if game.get('stream_start_time', None):
            game['stream_start_time'] *= 1000
        return game


class LadderPosition(db.Entity):
    _table_ = "ladder_position"
    id = PrimaryKey(int, auto=True)
    competition = Required(Competitions, column='competition_id')
    team = Required(Clubs, column='team_id')
    position = Required(int)
    time_created = NullableOptional(int)

    composite_key(competition, team)

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        return d


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

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        d['game_id'] = self.game.id
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

    @db_session
    def format_for_frontend(self):
        raise Exception('Users should not leave the backend!')
