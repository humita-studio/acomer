import type { Metadata } from 'next';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { obtenerReservasConfig } from '@/features/reservas/reservasConfigActions';
import { turnosConSlots } from '@/features/reservas/reservasConfig';
import { ReservarForm } from '@/features/reservas/components/ReservarForm';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 text-center">
        <div className="bg-card p-8 rounded-2xl border shadow-sm">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">Restaurante no encontrado</p>
        </div>
      </div>
    );
  }

  const config = await obtenerReservasConfig(tenantId);

  if (!config.activo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 text-center">
        <div className="bg-card p-8 rounded-2xl border shadow-sm max-w-md">
          <h1 className="text-2xl font-bold mb-2">Reservas no disponibles</h1>
          <p className="text-muted-foreground">
            Por el momento no estamos tomando reservas online. Comunicate con el local para reservar.
          </p>
        </div>
      </div>
    );
  }

  return <ReservarForm tenantSlug={tenant} turnos={turnosConSlots(config.turnos)} />;
}
