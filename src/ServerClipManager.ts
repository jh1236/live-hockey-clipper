import fs from 'node:fs/promises'
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {hmsToSecondsOnly} from "@/utils";
import {getDbSession, tClips, tGames} from "@/database/database";

const execFileAsync = promisify(execFile)

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
    try {
        const link: string = await getLinkFromBlob(blob, token)
        const indexFile = await fetch(link);
        const text = await indexFile.text();
            await using db = await getDbSession()
        const {connection} = db;
        // @ts-expect-error I haven't put these values in, but this is the easier way to type this.
        const gameEntry: {
            blob: string,
            teamOne: string,
            teamTwo: string,
            teamOneImage: string,
            teamTwoImage: string,
            competitionName: string,
        } = {blob}
        await fs.writeFile(`./videos/input/${blob}.m3u8`, text)
        const tasks = []
        const maybeId = await db.connection.selectFrom(tGames).selectOneColumn(tGames.id).where(tGames.blob.equals(blob)).executeSelectNoneOrOne()
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
            let gameId;
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
        }
    } catch (e) {
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
