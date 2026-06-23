import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            allowedOrigins: ['2k0lvsl4-3000.brs.devtunnels.ms', 'localhost:3000'],
        },
        optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
        staleTimes: {
            dynamic: 30,
        },
    },
};

export default nextConfig;
