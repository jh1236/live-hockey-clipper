import {NextRequest, NextResponse} from "next/server";
import {Clip, serverDownloadSingleClip, serverDownloadTestClip} from "@/LiveHockeyManager";
import {hmsToSecondsOnly} from "@/utils";
import {getDbSession, tClips, tGames} from "@/database/database";


export async function POST(
    req: NextRequest,
) {
    console.log("Request")
    const json = await req.json();
    const {gameBlob, clip, quality, username, password} = (json as {
        gameBlob: string,
        clip: Clip,
        quality: number,
        username?: string,
        password?: string
    });

    if (gameBlob === 'test') {
        const clipOut = await serverDownloadTestClip(clip, quality, json.startTime);
        return NextResponse.json({clip: clipOut});
    }

    const connection = await getDbSession()

    const game = await connection.selectFrom(tGames).select({
        id: tGames.id,
        teamOne: tGames.teamOne,
        teamTwo: tGames.teamTwo,
        teamOneLongName: tGames.teamOneLongName,
        teamTwoLongName: tGames.teamTwoLongName,
        teamOneImage: tGames.teamOneImage,
        teamTwoImage: tGames.teamTwoImage,
        competitionName: tGames.competitionName,
        startTime: tGames.startTime,
        lastServerPing: tGames.lastServerPing,
    }).where(tGames.blob.equals(gameBlob)).executeSelectOne()


    const clipOut = await serverDownloadSingleClip(gameBlob, clip, quality, username, password);

    if (clipOut === null) {
        return Response.error()
    }


    await connection.transaction(async () => {
        await connection.insertInto(tClips).values({
            gameId: game.id,
            name: clipOut.name!,
            startTime: hmsToSecondsOnly(clipOut.timecode),
            duration: hmsToSecondsOnly(clipOut.length),
            link: clipOut.link!,
            comment: clip.comment,
        }).executeInsert()
    })


    return NextResponse.json({clip: clipOut});
}
