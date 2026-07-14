import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        // Cloudinary sirve f_auto/q_auto; listamos el host por si usamos next/image sin unoptimized.
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '/**',
            },
        ],
    },
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
