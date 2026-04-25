import fs from "node:fs/promises";
import {after, NextRequest} from "next/server";

export async function GET(req: NextRequest, {
    params
}: {
    params: Promise<{ blob: string, clip: string }>
}) {
    const {blob, clip} = await params;
    const fileHandle = await fs.open(`./videos/output/${blob}/${clip}`);
    const stream = fileHandle.readableWebStream({type: "bytes"})
    after(async () => {
        await fileHandle.close();
    })
    return new Response(stream as ReadableStream<any>)
}