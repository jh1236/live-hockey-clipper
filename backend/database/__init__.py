from pony.orm import Database, PrimaryKey, Required, Optional, Set

db = Database()


def init_db():
    db.bind(provider='sqlite', filename='/database/database.db', create_db=True)
    db.generate_mapping(create_tables=False)


NullableOptional = lambda a: Optional(a, nullable=True)

class Umpires(db.Entity):
    id = PrimaryKey(int, auto=True)
    name = Required(str, unique=True)
    gender = Required(str)
    time_created = NullableOptional(int)
    games_first_official = Set('Games', reverse='official_one')
    games_second_official = Set('Games', reverse='official_two')


class Games(db.Entity):
    id = PrimaryKey(int, auto=True)
    blob = Required(str)
    team_one = Required(str)
    team_two = Required(str)
    team_one_long_name = Required(str)
    team_two_long_name = Required(str)
    team_one_image = Required(str)
    team_two_image = Required(str)
    competition_name = Required(str)
    start_time = Required(int)
    last_server_ping = Required(int)
    time_created = NullableOptional(int)
    is_live = Required(bool)
    altius_link = NullableOptional(str)
    teamstar_link = NullableOptional(str)
    official_one = Optional(Umpires)
    official_two = Optional(Umpires)
    clips = Set('Clips')


class Clips(db.Entity):
    id = PrimaryKey(int, auto=True)
    game_id = Required(Games)
    name = Required(str)
    start_time = Required(int)
    duration = Required(int)
    link = NullableOptional(str)
    comment = NullableOptional(str)
    time_created = NullableOptional(int)


class Images(db.Entity):
    id = PrimaryKey(int, auto=True)
    name = Required(str)
    link = Required(str)
    time_created = NullableOptional(int)


class Users(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str)
    token = Required(str)
