import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            new URL('https://files.livearenasports.com/files/**'),
            new URL('https://hockey-cdn.altius.live/hockeywa/content/**'),
            new URL('https://api.clip.jh1236.top/**'),
            new URL('http://localhost:5003/**')
        ],
        dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
        dangerouslyAllowSVG: true,
    },
    env: {
        NEXT_PUBLIC_BACKEND_ADDRESS: process.env.NEXT_PUBLIC_BACKEND_ADDRESS,
    },
    output: 'standalone'
};

export default nextConfig;
