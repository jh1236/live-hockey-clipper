import fs from 'node:fs/promises'
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {hmsToSecondsOnly} from "@/utils";
import {getDbSession, tClips, tGames, Game} from "@/database/database";
import {LiveHockeyGame} from "@/app/api/game/types";

const execFileAsync = promisify(execFile)


const LiveHockeyCompToShortName = {
    'WA Premier League - Women': 'Prem 1 Women',
    'WA Premier League - Men': 'Prem 1 Men',
    'WA Premier Div 2 - Women': 'Prem 2 Women',
    'WA Premier Div 2 - Men': 'Prem 2 Men',
    'WA PREMIER DIV 3 - WOMEN': 'Prem 3 Women',
    'WA PREMIER DIV 3 - MEN': 'Prem 3 Men',
}

export function formatLiveHockeyGame(it: LiveHockeyGame) {
    return ({
        blob: it.id,
        isLive: it.live,
        competitionName:
            LiveHockeyCompToShortName[it.competition.playerLevel.name as keyof typeof LiveHockeyCompToShortName] ?? it.competition.playerLevel.name,
        teamOne: it.homeTeam.shortName,
        teamTwo: it.awayTeam.shortName,
        teamOneLongName: it.homeTeam.longName,
        teamTwoLongName: it.awayTeam.longName,
        teamOneImage: `https://files.livearenasports.com/files/${it.homeTeam.logo?.blobId ?? '33e72f46-b1e5-48de-a411-14bf28de0b5c'}`,
        teamTwoImage: `https://files.livearenasports.com/files/${it.awayTeam.logo?.blobId ?? '33e72f46-b1e5-48de-a411-14bf28de0b5c'}`,
        startTime: new Date(it.streamStart ?? it.start).getTime(),
        lastServerPing: Date.now()
    });
}

export async function getLiveHockeyToken(username: string, password: string): Promise<string> {
    return await fetch("https://api.livearenasports.com/user/login", {
        method: "POST",
        headers: {
            'site-id': 'AU_FH_AUS',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userName: username,
            password
        })
    }).then(it => it.json()).then(data => data.jwt_token as string);
}

export async function getLinkFromBlob(blob: string, token: string): Promise<string> {
    return await fetch(
        `https://api.livearenasports.com/broadcast/video/${blob}?video-format=HLS`,
        {headers: {Authorization: `Bearer ${token}`, 'site-id': 'AU_FH_AUS'}}
    ).then(res => res.json()).then(data => data.videoUrl as string)
}

export type Clip = {
    timecode: string,
    length: string,
    name: string,
    link?: string,
    comment?: string,
};

export async function serverDownloadMultipleClips(
    blob: string,
    token: string,
    clips: Clip[], addToDatabase: boolean = true): Promise<void> {
    const connection = await getDbSession()
    if (addToDatabase) {
        await connection.beginTransaction()
    }
    try {
        const link: string = await getLinkFromBlob(blob, token)
        const indexFile = await fetch(link);
        const text = await indexFile.text();
        // @ts-expect-error I haven't put these values in, but this is the easier way to type this.
        const gameEntry: Game = {blob}
        await fs.writeFile(`./videos/input/${blob}.m3u8`, text)
        const tasks = []
        const maybeId = await connection.selectFrom(tGames).selectOneColumn(tGames.id).where(tGames.blob.equals(blob)).executeSelectNoneOrOne()
        if (addToDatabase && maybeId === null) {
            tasks.push(await fetch(
                `https://api.livearenasports.com/broadcast/${blob}`,
                {
                    headers: {'site-id': "AU_FH_AUS"}
                }
            ).then(it => it.json()).then(it => {
                gameEntry.competitionName = it.competition.playerLevel.name
                gameEntry.teamOne = it.homeTeam.shortName
                gameEntry.teamTwo = it.awayTeam.shortName
                gameEntry.teamOneImage = `https://files.livearenasports.com/files/${it.homeTeam.logo.blobId}`
                gameEntry.teamTwoImage = `https://files.livearenasports.com/files/${it.awayTeam.logo.blobId}`
                gameEntry.startTime = new Date(it.streamStart).getTime()
                gameEntry.lastServerPing = Date.now()
            }));
        }
        await fs.mkdir(`./videos/output/${blob}`, {recursive: true});

        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const output = `./videos/output/${blob}/${clip.name}.mp4`;

            const args = [
                "-y",
                "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
                "-ss", (Math.max(hmsToSecondsOnly(clip.timecode) - 10, 0)).toString(),
                "-copyts",
                "-i", `./videos/input/${blob}.m3u8`,
                "-ss", (hmsToSecondsOnly(clip.timecode)).toString(),
                "-t", clip.length.toString(),
                "-c:v", "libx264",
                "-c:a", "aac",
                "-preset", "veryfast",
                "-crf", "32",
                "-fflags", "+genpts",
                "-f", "mp4",
                output
            ];

            console.log(`ffmpeg ${args.join(' ')}`)
            tasks.push(execFileAsync("ffmpeg", args));
        }
        await Promise.all(tasks)
        if (addToDatabase) {
            let gameId: number;
            if (maybeId === null) {
                gameId = await connection.insertInto(tGames).values(gameEntry).returningLastInsertedId().executeInsert();
            } else {
                gameId = maybeId;
            }
            const newTasks: Promise<never>[] = []
            for (const clip of clips) {
                const to_add = {
                    gameId,
                    name: clip.name!,
                    startTime: hmsToSecondsOnly(clip.timecode),
                    duration: hmsToSecondsOnly(clip.length),
                    link: `/api/videos/${blob}/${clip.name}.mp4`,
                    comment: clip.comment,
                }
                tasks.push(connection.insertInto(tClips).values(to_add).executeInsert())
            }
            await Promise.all(newTasks)
            await connection.commit()
        }
    } catch (e) {
        await connection.rollback()
        throw e
    } finally {
        const tasks: Promise<void>[] = []
        for (const file of await fs.readdir('./videos/input')) {
            if (file === '.gitkeep') continue;
            tasks.push(fs.unlink(path.join('./videos/input', file)));
        }
        await Promise.all(tasks)
    }
}


export async function serverDownloadSingleClip(
    blob: string,
    clip: Clip): Promise<Clip> {

    const clipOut = {...clip}

    await fs.mkdir(`./videos/output/${blob}`, {recursive: true});

    const output = `./videos/output/${blob}/${clip.name}.mp4`;

    const args = [
        "-y",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-ss", (Math.max(hmsToSecondsOnly(clip.timecode) - 10, 0)).toString(),
        "-copyts",
        "-i", `./videos/input/${blob}.m3u8`,
        "-ss", (hmsToSecondsOnly(clip.timecode)).toString(),
        "-t", clip.length.toString(),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "veryfast",
        "-crf", "32",
        "-fflags", "+genpts",
        "-f", "mp4",
        output
    ];

    clipOut.link = `/api/videos/${blob}/${clip.name}.mp4`;

    await execFileAsync("ffmpeg", args);

    return clipOut

}
