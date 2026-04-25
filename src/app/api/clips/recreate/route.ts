import {NextRequest, NextResponse} from "next/server";
import {serverDownloadMultipleClips} from "@/ServerClipManager";
import {getDbSession, tClips, tGames} from "@/database/database";
import {secondsToHMS} from "@/utils";


export async function POST(
    req: NextRequest,
) {
    console.log("Request")
    const {gameBlob, username, password} = await req.json();

        await using db = await getDbSession();
    const {connection} = db;

    const token = await fetch("https://api.livearenasports.com/user/login", {
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

    const clips = await connection.selectFrom(tClips).innerJoin(tGames).on(tClips.gameId.equals(tGames.id)).select({
        name: tClips.name,
        length: tClips.duration,
        timecode: tClips.startTime,
        link: tClips.link,
    }).where(tClips.gameId.equals(tGames.id)).executeSelectMany()

    await serverDownloadMultipleClips(gameBlob, token!, clips.map(it => ({...it, length: secondsToHMS(it.length), timecode: secondsToHMS(it.length)})))
    return NextResponse.json({ok: true});
}
