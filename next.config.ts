import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad básicas para todas las rutas. Vercel ya agrega HSTS
 * en dominios custom; acá cubrimos clickjacking, sniffing y permisos del browser.
 * `geolocation=(self)`: el checkout de delivery pide la ubicación del comensal.
 */
const SECURITY_HEADERS = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
    output: 'standalone',
    async headers() {
        return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
    },
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
