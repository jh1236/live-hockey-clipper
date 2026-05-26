import numpy
import asyncio
import time
from datetime import datetime

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


class SafeString(str):
    def lower(self):
        return self

    def title(self):
        return self

    def upper(self):
        return self
