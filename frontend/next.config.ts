import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [new URL('https://files.livearenasports.com/files/**')],
        dangerouslyAllowSVG: true,
    },
    output: 'standalone'
};

export default nextConfig;
