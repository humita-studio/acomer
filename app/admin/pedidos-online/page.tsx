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
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-52 rounded-lg" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[264px] shrink-0 space-y-2.5 rounded-xl bg-muted/60 p-2.5">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-5 rounded-full" />
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
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
    <PedidosOnlineManager
      tenantId={session.restauranteId}
      initialOrdenes={ordenes as never}
      initialConfig={configRes.config}
    />
  );
}

export default function PedidosOnlinePage() {
  return (
    <Suspense fallback={<PedidosSkeleton />}>
      <PedidosContent />
    </Suspense>
  );
}
