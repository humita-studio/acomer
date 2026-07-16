import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getCajaActualAction, getHistorialCajasAction } from '@/features/caja/cajaActions';
import { CajaManager } from '@/features/caja/components/CajaManager';
import { NuevaVentaButton } from '@/features/venta-mostrador/components/NuevaVentaButton';
import { Skeleton } from '@/shared/ui/skeleton';

function CajaSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-56" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

async function CajaContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'cashier')) {
    redirect('/unauthorized');
  }

  const [initialCaja, initialHistorial] = await Promise.all([
    getCajaActualAction(),
    getHistorialCajasAction(),
  ]);

  return (
    <CajaManager
      initialCaja={initialCaja}
      initialHistorial={initialHistorial}
      tenantId={session.restauranteId}
      headerExtras={<NuevaVentaButton tenantId={session.restauranteId} />}
    />
  );
}

export default function CajaPage() {
  return (
    <Suspense fallback={<CajaSkeleton />}>
      <CajaContent />
    </Suspense>
  );
}
