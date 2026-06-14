import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            allowedOrigins: ['2k0lvsl4-3000.brs.devtunnels.ms', 'localhost:3000'],
        },
    },
};

export default nextConfig;
