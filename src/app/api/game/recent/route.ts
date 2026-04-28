import {NextRequest} from "next/server";
import {StructureResponse} from "@/app/api/game/recent/types";
import {formatLiveHockeyGame} from "@/LiveHockeyManager";
import {LiveHockeyGame} from "@/app/api/game/types";
import {Game} from "@/database/database";

async function getRequestURL(comps: StructureResponse["competitions"], count: number = 16) {


    const url = new URL("https://api.livearenasports.com/broadcast/?")

    for (const comp of comps) {
        url.searchParams.append('competition-id', comp.id)
    }
    url.searchParams.set('page-index', '0')
    url.searchParams.set('page-size', count.toString())
    url.searchParams.set('include-live', 'true')
    url.searchParams.set('sort-column', 'start')
    return url;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export async function GET(req: NextRequest) {

    const location = req.nextUrl.searchParams.get('location');
    const juniors = req.nextUrl.searchParams.get('juniors') === 'true';
    const premierOnly = req.nextUrl.searchParams.get('premier') === 'true';


    const thisYear = new Date().getFullYear().toString();
    const comps = await fetch(
        `https://api.livearenasports.com/site/structure?slug=live${location}`,
        {
            headers: {'site-id': "AU_FH_AUS"},
        }
    )
        .then((it) => it.json())
        .then((it: [StructureResponse]) => it[0])
        .then(it => it.competitions.filter((it) => {
                if (!it.name.includes(thisYear)) return false;
                if (premierOnly) {
                    if (juniors && it.name.match(/WA J ((9\/10)|(11\/12)) Division 1/)) {
                        return true
                    }
                    return it.name.toLowerCase().includes('premier')
                } else {
                    if (juniors) {
                        return true
                    }
                    return !it.name.match(/WA J ((5\/6)|(7\/8)|(9\/10)|(11\/12))/)
                }


            }
        ))
    const now = new Date()
    const dateTo = new Date(now.getTime() + 4 * DAY_IN_MS);
    const futureUrl = await getRequestURL(comps, 8);
    futureUrl.searchParams.set('sort-order', 'Ascending')
    futureUrl.searchParams.set('start-from', now.toISOString().replace(/ GMT/, ''))
    futureUrl.searchParams.set('start-to', dateTo.toISOString().replace(/ GMT/, ''))
    const pastUrl = await getRequestURL(comps, 8);
    pastUrl.searchParams.set('sort-order', 'Descending')
    pastUrl.searchParams.set('start-to', now.toISOString().replace(/ GMT/, ''))

    const out: {
        upcoming: Game[],
        recent: Game[],
    } = {
        upcoming: [],
        recent: []
    }
    const tasks = []
    tasks.push(await fetch(futureUrl, {headers: {'site-id': "AU_FH_AUS"},})
        .then(it => it.json())
        .then((it: LiveHockeyGame[]) => it.map(g => formatLiveHockeyGame(g, false))).then(it => {
                out.upcoming.push(...it)
            }
        ))
    tasks.push(await fetch(pastUrl, {headers: {'site-id': "AU_FH_AUS"},})
        .then(it => it.json())
        .then((it: LiveHockeyGame[]) => it.map(g => formatLiveHockeyGame(g, false))).then(it => {
                out.recent.push(...it.filter(game => !game.isLive))
                out.upcoming.splice(0, 0, ...it.filter(game => game.isLive).toReversed())
            }
        ))

    return Response.json(out)
}