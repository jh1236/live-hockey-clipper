import {getDbSession, tClips, tGames} from "@/database/database";
import {NextRequest} from "next/server";
import fs from "node:fs/promises";
import {formatLiveHockeyGame, getLinkFromBlob, getLiveHockeyToken} from "@/LiveHockeyManager";
import {secondsToHMS} from "@/utils";

// how many seconds before we consider going to the live hockey server again
const RELOAD_TIMEOUT = 60 * 1000


export async function POST(req: NextRequest) {
    const {gameBlob, username, password} = await req.json()
    const token = await getLiveHockeyToken(username, password)
    const connection = await getDbSession()

    // check if the game is in the database
    let game = await connection.selectFrom(tGames).select({
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
        teamstarLink: tGames.teamstarLink,
        altiusLink: tGames.altiusLink,
    }).where(tGames.blob.equals(gameBlob)).executeSelectNoneOrOne()

    if (game === null) {
        // if the game isn't in the database, fetch it and add it
        await connection.transaction(async () => {
                game = await fetch(
                    `https://api.livearenasports.com/broadcast/${gameBlob}`,
                    {
                        headers: {'site-id': "AU_FH_AUS"},
                    }
                ).then(it => it.json()).then(formatLiveHockeyGame).then(async it => {
                    const id = await connection.insertInto(tGames).values(
                        it
                    ).returningLastInsertedId().executeInsert()
                    return {...it, id}
                });
            }
        )


    } else if (game.lastServerPing + RELOAD_TIMEOUT < Date.now()) {
        await connection.transaction(async () => {
            game = await fetch(
                `https://api.livearenasports.com/broadcast/${gameBlob}`,
                {
                    headers: {'site-id': "AU_FH_AUS"},
                }
            ).then(it => it.json()).then(formatLiveHockeyGame).then(async it => {
                const {startTime, isLive} = await connection.update(tGames).set({
                    isLive: it.isLive,
                    startTime: it.startTime
                }).where(tGames.id.equals(game!.id)).returning({
                    isLive: tGames.isLive,
                    startTime: tGames.startTime
                }).projectingOptionalValuesAsNullable().executeUpdateOne()
                return {...game!, isLive, startTime}
            });
        })

    }

    // get the clips for the game
    const clips = await connection.selectFrom(tClips).innerJoin(tGames).on(tClips.gameId.equals(tGames.id)).select({
        name: tClips.name,
        length: tClips.duration,
        timecode: tClips.startTime,
        link: tClips.link,
        comment: tClips.comment,
    }).where(tClips.gameId.equals(game!.id)).executeSelectMany()

    const link: string = await getLinkFromBlob(gameBlob, token)
    const indexFile = await fetch(link);
    const text = await indexFile.text();
    await fs.writeFile(`./videos/input/${gameBlob}.m3u8`, text)


    return Response.json({
        game,
        clips: clips.map(it => ({...it, length: secondsToHMS(it.length), timecode: secondsToHMS(it.timecode!)}))
    })
}