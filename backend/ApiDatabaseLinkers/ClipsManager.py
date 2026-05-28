import asyncio
import contextlib
import dataclasses
import logging
import os
import re
from datetime import datetime, timedelta

from pony.orm import db_session, select
from sanitize_filename import sanitize

from ApiFetchers import LiveHockeyFetcher
from config import get_config
from database import Clips
from requester import client
from utils import time_to_int, sleep_for_approx

logger = logging.Logger('ClipsManager')


@dataclasses.dataclass
class ClipDto:
    id: int | None
    game_blob: str
    start_time: str
    duration: str
    name: str
    favourite: bool = False
    link: str | None = None
    categories: list[str] | None = None

    @db_session
    def add_to_database(self, game_id):
        out = Clips(start_time=time_to_int(self.start_time), duration=time_to_int(self.duration), name=self.name,
                    link=self.link, comment=';'.join(self.categories) if self.categories else '', game=game_id,
                    favourite=self.favourite)
        out.flush()
        self.id = out.id
        return out

async def remove_old_videos():
    #needs to be async for task managing
    with db_session():
        two_days_ago = (datetime.now() - timedelta(days=2)).timestamp()
        clips: list[Clips] = list(select(i for i in Clips if not i.favourite and i.time_created < two_days_ago))
        for clip in clips:
            file_path = f'{get_config().videos_folder}/{clip.link.split("/api/clips/")[1]}'
            clip.delete()
            os.remove(file_path)


async def download_clip_for_game(
        blob: str,
        clip: Clips,
        quality: int,
        username: str = None,
        password: str = None
):
    logger.error('Downloading clip for game %s', blob)
    clip_start_time = max(clip.start_time - 2, 0)
    clip_end_time = max(clip.start_time + clip.duration + 2, 0)

    index_url = await LiveHockeyFetcher.get_video_link_from_blob(blob, username, password)
    index_file = (await client.get(index_url)).text

    files = []
    segment_start_time = 0
    segment_finish_time = 0
    first_time = -1
    attempts = 0
    while attempts < 3:
        for line in index_file.split('\n'):
            if line.startswith("#EXTINF:"):
                segment_start_time = segment_finish_time
                segment_finish_time += float(line.split("#EXTINF:")[1].split(",")[0])
            elif not line.startswith(
                    '#') and segment_finish_time > clip_start_time and segment_start_time < clip_end_time:
                if first_time < 0:
                    first_time = segment_start_time
                files.append(line)
        if segment_finish_time < clip_end_time:
            attempts += 1
            await sleep_for_approx(3)
        else:
            break

    if attempts == 4:
        raise Exception('Too far in future!')

    logger.warning('first time: %s', first_time)
    logger.warning('files: %s', '\n'.join([re.sub('.*/', '', i) for i in files]))

    folder = get_config().videos_folder + f'/{sanitize(blob)}'

    os.makedirs(folder, exist_ok=True)
    output_location = f'{folder}/{sanitize(str(clip.id))}.mp4'
    with contextlib.suppress(FileNotFoundError):
        os.remove(output_location)

    args: list[str] = [
        "ffmpeg",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto,concat",
        "-y",
        "-i", "concat:" + "|".join(files),
        "-ss", str(clip_start_time - first_time),
        "-t", str(clip.duration + 4),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "veryfast",
        "-crf", f"{40 - 2 * quality}",
        "-f", "mp4",
        output_location
    ]
    logger.warning(' '.join(args))
    process = await asyncio.create_subprocess_exec(*args)

    async def kill_after_time():
        await asyncio.sleep(120)
        process.terminate()

    tasks = [asyncio.create_task(i) for i in [process.communicate(), kill_after_time()]]
    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for i in tasks:
        if not i.done(): i.cancel()
    if process.returncode:
        return None

    return f'{get_config().server_address}/api/clips/{blob}/{clip.id}.mp4'
