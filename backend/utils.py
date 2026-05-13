import time
from datetime import datetime


def int_to_time(time_in: int) -> str:
    return time.strftime('%H:%M:%S', time.gmtime(time_in))


def time_to_int(timestr):
    seconds = 0
    for part in timestr.split(':'):
        seconds = seconds * 60 + int(part, 10)
    return seconds

def format_iso(dt: datetime) -> str:
    return dt.isoformat(timespec='milliseconds').replace('+00:00', '') + 'Z'
