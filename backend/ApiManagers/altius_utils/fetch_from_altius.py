import logging
import os
from collections import defaultdict
from typing import Literal, Callable

import httpx

from config import get_config
from requester import client
from utils import sleep_for_approx

all_tournaments = [57, 58, 59, 60, 52, 51, 54, 53, 45, 46, 43, 44, 39, 40, 33, 34, 25, 26, 17, 18, 12, 11, 7, 8, 3, 4]

base_url = "https://hockeywa.altiusrt.com/competitions"


async def _get_officials_from_altius(tournament, force_regen=False, *, attempts=3) -> tuple[str, bool]:
    if attempts == 0:
        raise Exception('Too many attempts to fetch from altius, and cache is empty!')
    cache_folder = get_config().cache_folder
    os.makedirs(cache_folder, exist_ok=True)
    if os.path.exists(f'{cache_folder}/{tournament}_officials.html') and not force_regen:
        with open(f'{cache_folder}/{tournament}_officials.html', 'r') as f:
            return f.read(), True
    try:
        page = await client.get(f"{base_url}/{tournament}/officials")
        html = page.read().decode("utf-8")
        with open(f'{cache_folder}/{tournament}_officials.html', 'w+') as f:
            f.write(html)
        return html, False
    except httpx.HTTPError:
        logging.warning('Altius API returned HTTP error')
        if os.path.exists(f'{cache_folder}/{tournament}_officials.html') and force_regen:
            with open(f'{cache_folder}/{tournament}_officials.html', 'r') as f:
                return f.read(), False
        else:
            await sleep_for_approx(1)
            return await _get_officials_from_altius(tournament=tournament, force_regen=force_regen,
                                                    attempts=attempts - 1)


async def _get_ladder_from_altius(tournament, force_regen=False, *, attempts=3) -> tuple[str, bool]:
    if attempts == 0:
        raise Exception('Too many attempts to fetch from altius, and cache is empty!')
    cache_folder = get_config().cache_folder
    os.makedirs(cache_folder, exist_ok=True)
    if os.path.exists(f'{cache_folder}/{tournament}_ladder.html') and not force_regen:
        with open(f'{cache_folder}/{tournament}_ladder.html', 'r') as f:
            return f.read(), True
    try:
        page = await client.get(f"{base_url}/{tournament}/pools")
        html = page.read().decode("utf-8")
        with open(f'{cache_folder}/{tournament}_ladder.html', 'w+') as f:
            f.write(html)
        return html, False
    except httpx.HTTPError:
        logging.warning('Altius API returned HTTP error')
        if os.path.exists(f'{cache_folder}/{tournament}_ladder.html') and force_regen:
            with open(f'{cache_folder}/{tournament}_ladder.html', 'r') as f:
                return f.read(), False
        else:
            await sleep_for_approx(1)
            return await _get_ladder_from_altius(tournament=tournament, force_regen=force_regen,
                                                 attempts=attempts - 1)


async def _get_games_from_altius(tournament, force_regen=False, *, attempts=3) -> tuple[str, bool]:
    if attempts == 0:
        raise Exception('Too many attempts to fetch from altius, and cache is empty!')
    cache_folder = get_config().cache_folder
    os.makedirs(cache_folder, exist_ok=True)
    if os.path.exists(f'{cache_folder}/{tournament}_games.html') and not force_regen:
        with open(f'{cache_folder}/{tournament}_games.html', 'r') as f:
            return f.read(), True
    try:
        page = await client.get(f"{base_url}/{tournament}/matches")
        html = page.read().decode("utf-8")
        with open(f'{cache_folder}/{tournament}_games.html', 'w+') as f:
            f.write(html)
        return html, False
    except httpx.HTTPError:
        logging.warning('Altius API returned HTTP error')
        if os.path.exists(f'{cache_folder}/{tournament}_games.html') and force_regen:
            with open(f'{cache_folder}/{tournament}_games.html', 'r') as f:
                return f.read(), False
        else:
            await sleep_for_approx(1)
            return await _get_ladder_from_altius(tournament=tournament, force_regen=True,
                                                 attempts=attempts - 1)

altius_data = Literal['games'] | Literal['ladder'] | Literal['officials']

_fetchers: dict[altius_data, Callable] = {
    'games': _get_games_from_altius,
    'ladder': _get_ladder_from_altius,
    'officials': _get_officials_from_altius,
}

async def get_from_altius(tournaments: list[int], *fields: altius_data,  force_regen=False) -> dict[int, dict[altius_data, str]]:
    out = defaultdict(dict)
    for tournament in tournaments:
        for field in fields:
            out[tournament][field], cache_hit = await _fetchers[field](tournament, force_regen=force_regen)
            if not cache_hit:
                await sleep_for_approx(1)
    return out