import {NextRequest} from "next/server";
import {getDbSession, tClips, tGames} from "@/database/database";
import {secondsToHMS} from "@/utils";

export async function GET(req: NextRequest) {
    const blob = req.nextUrl.searchParams.get("blob")!;
        await using db = await getDbSession();
    const {connection} = db;
    const game = await connection.selectFrom(tGames).select({
        id: tGames.id,
        teamOne: tGames.teamOne,
        teamTwo: tGames.teamTwo,
        teamOneImage: tGames.teamOneImage,
        teamTwoImage: tGames.teamTwoImage,
        competitionName: tGames.competitionName,
    }).where(tGames.blob.equals(blob)).executeSelectOne()

    const clips = await connection.selectFrom(tClips).select({
        name: tClips.name,
        length: tClips.duration,
        timecode: tClips.startTime,
        link: tClips.link,
    }).where(tClips.gameId.equals(game.id)).executeSelectMany()

    return Response.json({
        game,
        clips: clips.map(it => ({...it, length: secondsToHMS(it.length), timecode: secondsToHMS(it.length)}))
    })
}

