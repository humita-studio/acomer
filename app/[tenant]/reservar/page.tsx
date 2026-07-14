import type { Metadata } from 'next';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { obtenerReservasConfig } from '@/features/reservas/reservasConfigActions';
import { turnosConSlots } from '@/features/reservas/reservasConfig';
import { ReservarForm } from '@/features/reservas/components/ReservarForm';
import { ReservaEstadoBox } from '@/features/reservas/components/ReservaEstadoBox';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';

export const metadata: Metadata = {
  title: 'Reservar',
  description: 'Reservá tu mesa online de forma simple.',
};

export default async function ReservarPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const tenantId = await getTenantBySlug(tenant);

  if (!tenantId) {
    return <ReservaEstadoBox variante="not_found" />;
  }

  const [config, landing] = await Promise.all([
    obtenerReservasConfig(tenantId),
    obtenerLandingConfig(tenantId),
  ]);
  const whatsapp = landing.redes.whatsapp || undefined;

  if (!config.activo) {
    return <ReservaEstadoBox variante="offline" whatsapp={whatsapp} />;
  }

  return (
    <ReservarForm
      tenantSlug={tenant}
      turnos={turnosConSlots(config.turnos)}
      anticipacionMinMin={config.anticipacionMinMin}
    />
  );
}
