import {NextRequest, NextResponse} from "next/server";
import {Clip, serverDownloadSingleClip} from "@/LiveHockeyManager";
import {hmsToSecondsOnly} from "@/utils";
import {getDbSession, tClips, tGames} from "@/database/database";
import {setTimeout} from "timers/promises";


export async function POST(
    req: NextRequest,
) {
    console.log("Request")
    const {gameBlob, clip, quality, username, password} = (await req.json() as {
        gameBlob: string,
        clip: Clip,
        quality: number,
        username: string,
        password: string
    });
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

    console.log('Db Request done')
    // wait until 8 seconds after the latest time
    const clipEndTime = game.startTime + (hmsToSecondsOnly(clip.timecode) + hmsToSecondsOnly(clip.length)) * 1000 + 20_000;

    console.log(new Date(clipEndTime).toISOString())
    console.log(new Date().toISOString())
    // if (clipEndTime - 30_000 > Date.now()) {
    //
    //     throw Error('The clip goes too far into the future!')
    // } else if (clipEndTime > Date.now()) { //we can't clip video that doesn't exist yet
    //     console.log('Waiting!')
    //     await setTimeout(clipEndTime - Date.now())
    // }
    console.log(new Date().toISOString())
    console.log('Potential Waiting Done')

    const clipOut = await serverDownloadSingleClip(username, password, gameBlob, clip, quality);

    if (clipOut === null) {
        return Response.error()
    }


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
