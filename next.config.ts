import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
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
            allowedOrigins: [
                'localhost:3000',
                '*.localhost:3000',
                'acomer.com.ar',
                '*.acomer.com.ar',
                '2k0lvsl4-3000.brs.devtunnels.ms',
            ],
        },
        optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
        staleTimes: {
            dynamic: 30,
        },
    },
};

export default nextConfig;
