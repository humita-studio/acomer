import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getOrdenesExternasAction } from '@/features/pedidos-online/pedidoExternoActions';
import { getDeliveryConfigAction } from '@/features/pedidos-online/deliveryConfigActions';
import { PedidosOnlineManager } from '@/features/pedidos-online/components/PedidosOnlineManager';
import { Skeleton } from '@/shared/ui/skeleton';

function PedidosSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function PedidosContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'delivery')) redirect('/unauthorized');

  const [ordenesRes, configRes] = await Promise.all([
    getOrdenesExternasAction(),
    getDeliveryConfigAction(),
  ]);
  const ordenes = ordenesRes.success ? ordenesRes.ordenes : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Pedidos online</h1>
        <p className="text-muted-foreground">
          Retiros y envíos. Avanzá el estado de cada pedido hasta entregarlo.
        </p>
      </div>

      <PedidosOnlineManager
        tenantId={session.restauranteId}
        initialOrdenes={ordenes as never}
        initialConfig={configRes.config}
      />
    </div>
  );
}

export default function PedidosOnlinePage() {
  return (
    <Suspense fallback={<PedidosSkeleton />}>
      <PedidosContent />
    </Suspense>
  );
}
