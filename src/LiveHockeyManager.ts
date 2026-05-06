import fs from 'node:fs/promises'
import {spawn} from "node:child_process";
import {hmsToSecondsOnly} from "@/utils";
import {Game, getDbSession, tImages, tUsers} from "@/database/database";
import {LiveHockeyGame, LiveHockeyTeam} from "@/app/api/game/types";
import liveHockeyDefaultAccount from "@/../resources/liveHockeyDefault.json"

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
        isLive: game.live ?? false,
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
        lastServerPing: Date.now(),
        altiusLink: game.extSrc === 'ALT_WA' ? `https://hockeywa.altiusrt.com/matches/${game.extId}` : undefined,
        teamstarLink: game.extSrc === 'TEAMSTAR' ? `https://comp.teamstar.team/event/${game.extId}` : undefined
    });
}

export async function getLiveHockeyToken(usernameIn: string | null | undefined, passwordIn: string | null | undefined): Promise<string> {
    const username = usernameIn || liveHockeyDefaultAccount.username;
    const password = passwordIn || liveHockeyDefaultAccount.password;

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

export async function getLinkFromBlob(blob: string, usernameIn: string | null | undefined, passwordIn: string | null | undefined): Promise<string> {
    const username = usernameIn || liveHockeyDefaultAccount.username;
    const password = passwordIn || liveHockeyDefaultAccount.password;
    const connection = await getDbSession();
    let token = await connection.selectFrom(tUsers).selectOneColumn(tUsers.token).where(tUsers.username.equals(username)).executeSelectNoneOrOne();
    if (!token) {
        token = await getLiveHockeyToken(username, password)
        await connection.transaction(async () => {
            await connection.insertInto(tUsers).values({
                token: token!,
                username
            }).executeInsert();
        })
    }
    const output = await fetch(
        `https://api.livearenasports.com/broadcast/video/${blob}?video-format=HLS`,
        {headers: {Authorization: `Bearer ${token}`, 'site-id': 'AU_FH_AUS'}}
    ).then(res => res.json()).then(data => data.videoUrl as string).catch(() => null)
    if (output) {
        return output
    }
    token = await getLiveHockeyToken(username, password)
    await connection.transaction(async () => {
        await connection.update(tUsers).set({
            token: token!,
        }).where(tUsers.username.equals(username)).executeUpdate()
    })
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


export async function serverDownloadSingleClip(
    blob: string,
    clip: Clip,
    quality: number,
    username: string | null | undefined,
    password: string | null | undefined): Promise<Clip | null> {

    const clipOut = {...clip}
    const indexUrl = await getLinkFromBlob(blob, username, password)
    await fs.mkdir(`./videos/output/${blob}`, {recursive: true});

    const output = `./videos/output/${blob}/${clip.name}.mp4`;

    const args = [
        "-y",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-ss", (Math.max(hmsToSecondsOnly(clip.timecode) - 12, 0)).toString(),
        "-live_start_index", "0",
        // we remove 10 seconds so that we can avoid any silliness with keyframes on the edge,
        // and then remove 5 seconds to account for the delay that is inherent to live hockey
        "-i", indexUrl,
        '-avoid_negative_ts', 'make_zero',
        "-ss", '10'.toString(),
        "-t", (hmsToSecondsOnly(clip.length) + 4).toString(),
        "-c:v", "libx264",
        "-c:a", "flac",
        "-preset", "veryfast",
        "-r", "30",
        "-crf", `${40 - 2 * quality}`,
        "-af", "aresample=async=1000",
        "-f", "mp4",
        output
    ];

    console.log(`ffmpeg ${args.join(' ')}`)
    clipOut.link = `/api/videos/${blob}/${clip.name}.mp4`;
    const out = await new Promise<void>((resolve, reject) => {
        const child = spawn('ffmpeg', args);
        setTimeout(() => {
            //maximum time of 2 minutes
            child.kill()
            reject();
        }, 120_000)
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (data) => {
            console.log(`ffmpeg: ${data}`);
        })
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (data) => {
            console.log(`ffmpeg (error): ${data}`);
        })

        child.on('close', (code) => {
            if (code !== 0) {
                reject();
            } else {
                resolve();
            }
        })

    }).then(() => true).catch(() => false);

    return out ? clipOut : null

}


export async function serverDownloadTestClip(
    clip: Clip,
    quality: number,
    startTime: number
   ): Promise<Clip | null> {

    const clipOut = {...clip}
    const indexUrl = `http://localhost:3000/api/test.m3u8?${startTime}`
    await fs.mkdir('./videos/output/test', {recursive: true});

    const output = `./videos/output/test/${clip.name}.mp4`;

    const args = [
        "-y",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-ss", (Math.max(hmsToSecondsOnly(clip.timecode) - 12, 0)).toString(),
        "-live_start_index", "0",
        // we remove 10 seconds so that we can avoid any silliness with keyframes on the edge,
        // and then remove 5 seconds to account for the delay that is inherent to live hockey
        "-i", indexUrl,
        '-avoid_negative_ts', 'make_zero',
        "-ss", '10'.toString(),
        "-t", (hmsToSecondsOnly(clip.length) + 4).toString(),
        "-c:v", "libx264",
        "-c:a", "flac",
        "-preset", "veryfast",
        "-r", "30",
        "-crf", `${40 - 2 * quality}`,
        "-af", "aresample=async=1000",
        "-f", "mp4",
        output
    ];

    console.log(`ffmpeg ${args.join(' ')}`)
    clipOut.link = `/api/videos/test/${clip.name}.mp4`;
    const out = await new Promise<void>((resolve, reject) => {
        const child = spawn('ffmpeg', args);
        setTimeout(() => {
            //maximum time of 2 minutes
            child.kill()
            reject();
        }, 120_000)
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (data) => {
            console.log(`ffmpeg: ${data}`);
        })
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (data) => {
            console.log(`ffmpeg (error): ${data}`);
        })

        child.on('close', (code) => {
            if (code !== 0) {
                reject();
            } else {
                resolve();
            }
        })

    }).then(() => true).catch(() => false);

    return out ? clipOut : null

}
