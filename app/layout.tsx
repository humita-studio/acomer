import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { cn } from "@/shared/lib/utils";
import { Providers } from "./providers";
import { Toaster } from "@/shared/ui/sonner";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

// Display serif para titulares y números grandes (acompaña a Inter como cuerpo).
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://acomer.com.ar';

const defaultTitle = 'acomer — El sistema operativo de tu restaurante';
const defaultDescription =
  'Carta digital con QR, pedidos online, reservas, mesas, cobros con Mercado Pago y reportes. Todo tu restaurante en una sola plataforma.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: '%s · acomer',
  },
  description: defaultDescription,
  applicationName: 'acomer',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'acomer',
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable, fraunces.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
