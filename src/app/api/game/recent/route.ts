import {NextRequest} from "next/server";
import {StructureResponse} from "@/app/api/game/recent/types";
import {formatLiveHockeyGame} from "@/LiveHockeyManager";
import {LiveHockeyGame} from "@/app/api/game/types";

// how many seconds before we consider going to the live hockey server again

export async function GET(req: NextRequest) {

    // const {location} = await req.json();

    const location = 'livehockeywa';
    const thisYear = new Date().getFullYear().toString();
    const dateFrom = new Date()
    dateFrom.setHours(dateFrom.getHours() - 1);
    const comps = await fetch(
        `https://api.livearenasports.com/site/structure?slug=${location}`,
        {
            headers: {'site-id': "AU_FH_AUS"},
        }
    )
        .then((it) => it.json())
        .then((it: [StructureResponse]) => it[0])
        .then(it => it.competitions.filter((it) => it.name.toLowerCase().includes('premier') && it.name.includes(thisYear)))

    const url = new URL("https://api.livearenasports.com/broadcast/?")

    for (const comp of comps) {
        url.searchParams.append('competition-id', comp.id)
    }
    url.searchParams.set('page-index', '0')
    url.searchParams.set('page-size', '16')
    url.searchParams.set('include-live', 'true')
    url.searchParams.set('sort-column', 'start')
    url.searchParams.set('sort-order', 'Ascending')
    url.searchParams.set('start-from', dateFrom.toISOString().replace(/ GMT/, ''))


    const games = await fetch(url, {headers: {'site-id': "AU_FH_AUS"},})
        .then(it => it.json())
        .then((it: LiveHockeyGame[]) => it.map(formatLiveHockeyGame))
        .then(it => it.toReversed())

    const live = games.filter(it => it.isLive)
    const upcoming = games.filter(it => !it.isLive)

    return Response.json({games, live, upcoming})
}