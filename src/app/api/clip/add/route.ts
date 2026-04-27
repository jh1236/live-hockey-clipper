import {NextRequest, NextResponse} from "next/server";
import {Clip, serverDownloadSingleClip} from "@/LiveHockeyManager";
import {hmsToSecondsOnly} from "@/utils";
import {getDbSession, tClips, tGames} from "@/database/database";


export async function POST(
    req: NextRequest,
) {
    console.log("Request")
    const {gameBlob, clip} = (await req.json() as { gameBlob: string, clip: Clip });
    const connection = await getDbSession()
    const clipOut = await serverDownloadSingleClip(gameBlob, clip);

    await connection.transaction(async () => {
        const gameId = await connection.selectFrom(tGames).selectOneColumn(tGames.id).where(tGames.blob.equals(gameBlob)).executeSelectOne()
        await connection.insertInto(tClips).values({
            gameId,
            name: clipOut.name!,
            startTime: hmsToSecondsOnly(clipOut.timecode),
            duration: hmsToSecondsOnly(clipOut.length),
            link: clipOut.link!,
            comment: clip.comment,
        }).executeInsert()
    })


    return NextResponse.json({clip: clipOut});
}
