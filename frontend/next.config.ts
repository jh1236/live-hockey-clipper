import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [new URL('https://files.livearenasports.com/files/**'), new URL('hockey-cdn.altius.live/hockeywa/content/**')],
        dangerouslyAllowSVG: true,
    },
    env: {
        NEXT_PUBLIC_BACKEND_ADDRESS: process.env.NEXT_PUBLIC_BACKEND_ADDRESS,
    },
    output: 'standalone'
};

export default nextConfig;
