import asyncio
import re
import time
from datetime import datetime, timedelta, date, timezone
from typing import TypeVar, Iterator, Any

import humps
import numpy

NUMBERS = [
    'Zero',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen'
]
WORDS_TO_NUMBERS = {
    'Zero': 0,
    'One': 1,
    'Two': 2,
    'Three': 3,
    'Four': 4,
    'Five': 5,
    'Six': 6,
    'Seven': 7,
    'Eight': 8,
    'Nine': 9,
    'Ten': 10,
    'Eleven': 11,
    'Twelve': 12,
    'Thirteen': 13,
    'Fourteen': 14,
    'Fifteen': 15,
}

PERTH_TIMEZONE = timezone(timedelta(hours=+8))

def int_to_time(time_in: int) -> str:
    return time.strftime('%H:%M:%S', time.gmtime(time_in))


def time_to_int(timestr):
    seconds = 0
    for part in timestr.split(':'):
        seconds = seconds * 60 + int(part, 10)
    return seconds


def format_iso(dt: datetime) -> str:
    return dt.isoformat(timespec='milliseconds').replace('+00:00', '') + 'Z'


async def sleep_for_approx(seconds: float, *, std_dev=None) -> None:
    # used to make the timing between requests less consistent, so that it's not as obvious that it's not a person
    if std_dev is None:
        std_dev = 0.15 + seconds / 10
    sleep_time = numpy.random.normal(seconds, std_dev)
    await asyncio.sleep(sleep_time)


T = TypeVar('T')


def chunks(lst: list[T], n: int) -> Iterator[list[T]]:
    """Yield successive n-sized chunks from lst."""
    # snippet from https://stackoverflow.com/a/312464
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def fix_last_first_name(str):
    return ' '.join(reversed([j for j in re.sub(r'[()\[\]]', '', str).rsplit(' ', 1)]))


def get_monday(timestamp: int) -> datetime:
    now = date.fromtimestamp(timestamp)
    monday = now - timedelta(days=now.weekday())
    return datetime.combine(monday, datetime.min.time())


def camelise(d: T) -> T:
    if isinstance(d, list):
        return [camelise(i) for i in d]
    elif isinstance(d, dict):
        d: dict[str, Any]
        return {k if ' ' in k or k[0].isupper() else humps.camelize(k): camelise(v) for k, v in d.items()}
    else:
        return d


class SafeString(str):
    def lower(self):
        return self

    def title(self):
        return self

    def upper(self):
        return self


MINUTE_IN_SEC = 60
HOUR_IN_SEC = 60 * MINUTE_IN_SEC
DAY_IN_SEC = HOUR_IN_SEC * 24
