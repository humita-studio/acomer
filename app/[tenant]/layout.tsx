import type { Metadata } from 'next';
import { getTenantDetails } from '@/features/tenant/get-tenant';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';

type Props = {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant } = await params;
  const rest = await getTenantDetails(tenant);

  if (!rest || rest.deletedAt) {
    return {
      title: 'Local no encontrado',
      description: 'Revisá el enlace e intentá de nuevo.',
      robots: { index: false, follow: false },
    };
  }

  const config = await obtenerLandingConfig(rest.id);
  const description =
    config.descripcion.trim() ||
    `Carta digital, pedidos online y reservas en ${rest.nombre}.`;

  return {
    title: {
      default: rest.nombre,
      template: `%s · ${rest.nombre}`,
    },
    description,
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: 'acomer',
      title: rest.nombre,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: rest.nombre,
      description,
    },
  };
}

export default function TenantLayout({ children }: Props) {
  return <>{children}</>;
}
