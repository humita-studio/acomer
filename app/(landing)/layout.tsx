import type { Metadata } from 'next';

const title = 'acomer — El sistema operativo de tu restaurante';
const description =
  'Carta digital con QR, pedidos online, reservas, mesas, cobros con Mercado Pago y reportes. Probá gratis 14 días.';

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'acomer',
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
