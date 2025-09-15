import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [new URL('https://files.livearenasports.com/files/**')], 
    },
};

export default nextConfig;
