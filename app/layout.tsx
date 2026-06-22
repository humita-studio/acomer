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

export const metadata: Metadata = {
  title: "acomer — Panel",
  description: "Gestión de restaurante: mesas, menú, pedidos y caja.",
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
