import {NextRequest, NextResponse} from "next/server";
import {serverDownloadMultipleClips} from "@/ServerClipManager";
import {getDbSession, tGames} from "@/database/database";

export async function GET() {
    await using db = await getDbSession()
    const {connection} = db;
    const out = await connection.selectFrom(tGames).select({id: tGames.id}).executeSelectNoneOrOne()
    console.log(out)
    return Response.json(out)
}


export async function POST(
    req: NextRequest,
) {
    console.log("Request")
    const {gameBlob, username, password, clips} = await req.json();


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
    await serverDownloadMultipleClips(gameBlob, token!, clips)
    return NextResponse.json({ok: true});
}
