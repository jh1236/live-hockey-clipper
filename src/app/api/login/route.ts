import {NextRequest} from "next/server";

async function getLiveHockeyToken(username: string, password: string): Promise<string> {
    return await fetch("https://api.livearenasports.com/user/login", {
        method: "POST",
        headers: {
            'site-id': 'AU_FH_AUS',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userName: username,
            password
        })
    }).then(it => it.json()).then(data => data.jwt_token as string);
}

export async function POST(
    req: NextRequest) {
    const json = await req.json();
    const token = await getLiveHockeyToken(json.username, json.password);
    console.log(token);
    return new Response(token);
}