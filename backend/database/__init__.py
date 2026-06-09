import logging
import os
import re
from datetime import datetime

from pony.orm import Database, PrimaryKey, Required, Optional, Set, composite_key, db_session

from config import get_config
from utils import int_to_time, WORDS_TO_NUMBERS, NUMBERS, PERTH_TIMEZONE

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
    altius_id = NullableOptional(int, unique=True)
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
    cards = Set('GameCards', reverse='official')

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

    cards = Set('GameCards', reverse='team')
    home_games = Set('Games', reverse='home_team')
    away_games = Set('Games', reverse='away_team')

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        if self.image_link and self.image_link.startswith('/'):
            # this is a relative link
            d['image_link'] = get_config().server_address + self.image_link
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

    @property
    def identifier(self):
        out = f"{self.year}-"

        if self.age_level in ["Juniors", "Masters"]:
            age = self.level.split(" ")[0].replace("/", "")
            grade = WORDS_TO_NUMBERS[self.level.split(" Div ")[1].split(" ")[0]]
            b_or_g = ""
            if self.level.count(" ") == 3:
                b_or_g = self.level.split(" ")[3][0]
            out += f"{age}D{grade}{b_or_g.lower()}"
        elif self.is_premier:
            grade = WORDS_TO_NUMBERS[self.level.replace("Prem ", "")]
            out += f"P{grade}"
        else:
            grade = WORDS_TO_NUMBERS[self.level.split(" ")[1]]
            b_or_g = ""
            if self.level.count(" ") == 2:
                b_or_g = self.level.split(" ")[2][0]
            out += f"D{grade}{b_or_g.lower()}"

        if self.age_level == "Juniors":
            out += "-B" if self.gender == "M" else "-G"
        else:
            out += "-M" if self.gender == "M" else "-W"
        return out

    @property
    def name(self):
        year = ''
        if datetime.now().year != int(self.year):
            year = f'{self.year} '
        if self.age_level == 'Juniors':
            gender = "Boys" if self.gender == "M" else "Girls"
        else:
            gender = "Men" if self.gender == "M" else "Women"
        return f'{year}{self.level} {gender}'

    @db_session
    def format_for_frontend(self):
        d = self.to_dict()
        d['name'] = self.name
        d['identifier'] = self.identifier
        return d

    @staticmethod
    def get_by_identifier(identifier: str):
        year, level, gender = identifier.split('-', 3)
        gender = 'M' if gender in ['M', 'B'] else 'F'

        # Account for premier grades
        level = level.replace("P", "Prem ", 1)
        level = level.replace("D", " Div ", 1).strip(' ')
        if level[0].isdigit():
            # this is a junior game, and the '/' will have been stripped 
            level = re.sub(r"(\d\d\s)", r"/\1", level)  #

        level, grade = level.rsplit(" ", 1)

        if grade[-1] in ['g', 'b']:
            grade = f" {NUMBERS[int(grade[:-1])]} {'Gold' if grade[-1] == 'g' else 'Black'}"
        else:
            grade = f" {NUMBERS[int(grade)]}"
        level += grade
        logging.warning(f"{year = } {level = } {gender = }")
        return Competitions.get(level=level, gender=gender, year=year)


class Venues(db.Entity):
    id = PrimaryKey(int, auto=True)
    code = Required(str)
    long_name = NullableOptional(str)
    short_name = NullableOptional(str)
    turf_number = Required(int)
    time_created = NullableOptional(int)
    altius_id = NullableOptional(int)
    live_hockey_id = NullableOptional(str)
    teamstar_id = NullableOptional(str)

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
    altius_cards_populated = Required(bool, default=False)

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

    cards = Set('GameCards', reverse='game')
    clips = Set('Clips', reverse='game')

    @property
    def name(self):
        return f'{self.competition.name} - {self.home_team.code} v {self.away_team.code}'

    @property
    def identifier(self):
        return f'{self.competition.identifier}-{self.home_team.code.upper()}v{self.away_team.code.upper()}~{datetime.fromtimestamp(self.start_time, tz=PERTH_TIMEZONE).strftime('%d.%m.%H.%M')}'

    @staticmethod
    def get_by_identifier(identifier: str):
        comp_id, game_id = identifier.rsplit('-', 1)
        comp = Competitions.get_by_identifier(comp_id)
        home_team_code, away_team_code = game_id.split('~')[0].split('v', 1)
        home_team = Clubs.get(code=home_team_code)
        away_team = Clubs.get(code=away_team_code)
        start = datetime.strptime(f"{comp.year}.{game_id.split('~')[1]}.+0800", '%Y.%d.%m.%H.%M.%z')
        logging.warning(f'{home_team_code = }, {away_team_code = }, {start.timestamp() = }')
        return Games.get(competition=comp, home_team=home_team, away_team=away_team, start_time=int(start.timestamp()))

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
        game['name'] = self.name
        game['identifier'] = self.identifier
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
        d['game'] = self.game.format_for_frontend()
        d['start_time'] = int_to_time(self.start_time)
        d['duration'] = int_to_time(self.duration)
        d['categories'] = [i for i in self.comment.split(';') if i.strip()]
        del d['comment']
        return d


class GameCards(db.Entity):
    _table_ = 'game_cards'
    id = PrimaryKey(int, auto=True)
    game = Required(Games, column="game_id")
    team = Required(Clubs, column="team_id")
    official = Required(Officials, column="official_id")
    color = Required(str)
    minute = Required(int)
    player = NullableOptional(str)

    composite_key(team, official, color, minute, player, game)


class Users(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str)
    live_hockey_token = NullableOptional(str)
    whistle_iq_token = NullableOptional(str)
    whistle_iq_session = NullableOptional(str)

    @db_session
    def format_for_frontend(self):
        raise Exception('Users should not leave the backend!')
