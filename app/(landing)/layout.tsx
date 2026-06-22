import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'acomer — El sistema operativo de tu restaurante',
  description:
    'Carta digital con QR, pedidos online, reservas, mesas, cobros con Mercado Pago y reportes. Todo tu restaurante en una sola plataforma. Probá gratis 14 días.',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
