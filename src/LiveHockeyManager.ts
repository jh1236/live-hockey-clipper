import fs from 'node:fs/promises'
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {hmsToSecondsOnly} from "@/utils";
import {Game, getDbSession, tClips, tGames, tImages} from "@/database/database";
import {LiveHockeyGame, LiveHockeyTeam} from "@/app/api/game/types";

const execFileAsync = promisify(execFile)
let images: { [key: string]: string } = null!
let imagesIsLoading = true


function getTeamImage(team: LiveHockeyTeam): string {
    if (images === null) {
        images = {}
        imagesIsLoading = true
        getDbSession().then(connection =>
            connection.selectFrom(tImages).select({name: tImages.name, link: tImages.link}).executeSelectMany()
        ).then(it => {
                images = Object.fromEntries(it.map(e => [e.name, e.link]))
                imagesIsLoading = false
            }
        )
    }
    if (team.logo?.blobId === undefined) {
        if (team.shortName in images) {
            return images[team.shortName];
        }
        return 'https://files.livearenasports.com/files/33e72f46-b1e5-48de-a411-14bf28de0b5c'
    } else {
        if (!imagesIsLoading && !(team.shortName in images)) {
            images[team.shortName] = `https://files.livearenasports.com/files/${team.logo?.blobId}`;
            getDbSession().then(connection => {
                connection.insertInto(tImages).values({
                    link: `https://files.livearenasports.com/files/${team.logo?.blobId}`,
                    name: team.shortName
                }).executeInsert()
            })
        }
        return `https://files.livearenasports.com/files/${team.logo.blobId}`
    }
}

export function formatLiveHockeyGame(game: LiveHockeyGame, useStreamTime: boolean = true): Game {
    return ({
        blob: game.id,
        isLive: game.live,
        competitionName:
            game.competition.playerLevel.name
                .replace(/^WA J?/, '')
                .replace(/Premier League -/i, 'Prem 1')
                .replace(/Premier Div (\d) -/i, 'Prem $1')
                .replace(/B(\d*)$/, 'Div $1 Boys')
                .replace(/G(\d*)$/, 'Div $1 Girls')
                .replace('DIV', 'Div')
                .replace(/MEN/i, 'Men')
                .replace(/WOMEN/i, 'Women')
                .replace('RB Pennant -', 'Rae Blunt')
                .replaceAll(/[()]/g, ''),
        teamOne: game.homeTeam.shortName,
        teamTwo: game.awayTeam.shortName,
        teamOneLongName: game.homeTeam.longName,
        teamTwoLongName: game.awayTeam.longName,
        teamOneImage: getTeamImage(game.homeTeam),
        teamTwoImage: getTeamImage(game.awayTeam),
        startTime: new Date((useStreamTime ? game.streamStart : game.start) ?? game.start).getTime(),
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
    blob: string, clip: Clip, quality: number): Promise<Clip> {

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
        "-crf", `${15 + 4 * (quality)}`,
        "-fflags", "+genpts",
        "-f", "mp4",
        output
    ];

    clipOut.link = `/api/videos/${blob}/${clip.name}.mp4`;

    await execFileAsync("ffmpeg", args);

    return clipOut

}
