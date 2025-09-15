import {NextRequest, NextResponse} from "next/server";

export async function GET(
    req: NextRequest,
    {params}: { params: Promise<{ gameUUID: string; }>; }
) {
    const {gameUUID} = await params;
    if (!gameUUID) {
        return NextResponse.json({error: "Missing gameUUID"}, {status: 400});
    }

    try {
        const upstream = await fetch(
            `https://api.livearenasports.com/broadcast/${gameUUID}`,
            {
                cache: "force-cache", // or "force-cache" if you want to cache
                headers: {'site-id': "AU_FH_AUS"}
            }
        );

        if (!upstream.ok) {
            return NextResponse.json(
                {error: "Upstream error", status: upstream.status},
                {status: upstream.status}
            );
        }

        const data = await upstream.json();

        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "s-maxage=30, stale-while-revalidate=60", // optional edge cache
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            {error: "Fetch failed", detail: String(err)},
            {status: 500}
        );
    }
}
