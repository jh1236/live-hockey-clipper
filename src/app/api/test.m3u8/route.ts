import {NextRequest, NextResponse} from "next/server";
import {getLinkFromBlob} from "@/LiveHockeyManager";
import liveHockeyDefaultAccount from "@/../resources/liveHockeyDefault.json"


export async function GET(req: NextRequest) {
    const startTime = +req.nextUrl.searchParams.get('startTime')!;
    let currentTime = 0;

    const requestTime = Date.now();
    const indexUrl = await getLinkFromBlob('69e48d4e7e1ecd2dc6a82278', liveHockeyDefaultAccount.username, liveHockeyDefaultAccount.password)
    const index = await fetch(indexUrl);
    let lastId = 0
    const text = await index.text();

    const linesOut = []
    for (const line of text.split("\n")) {
        if (line.startsWith("#EXTINF:")) {
            const delta = +line.split("#EXTINF:")[1].split(",")[0] * 1000;
            if (currentTime + startTime + delta > requestTime) {
                break;
            }
            currentTime += delta;
        } else if (line.includes('https://')) {
            lastId = +line.split("https://lasvideoblobs1prod-highvol.b-cdn.net/vods/blobs1/69e48d4e7e1ecd2dc6a82278/")[1].split(".ts")[0];
        }

        linesOut.push(line);
    }

    linesOut.push(`#EXTINF:${Math.round(requestTime - (currentTime + startTime)) / 1000},`);
    linesOut.push(`https://lasvideoblobs1prod-highvol.b-cdn.net/vods/blobs1/69e48d4e7e1ecd2dc6a82278/${lastId + 1}.ts`);

    return new NextResponse(linesOut.join("\n"));
}