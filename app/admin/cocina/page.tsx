import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getPedidosCocinaAction } from '@/features/cocina/cocinaActions';
import { CocinaManager } from '@/features/cocina/components/CocinaManager';
import { Skeleton } from '@/shared/ui/skeleton';

function CocinaSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function CocinaContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'kitchen')) redirect('/unauthorized');

  const pedidos = await getPedidosCocinaAction();

  return (
    <CocinaManager initialPedidos={pedidos} tenantId={session.restauranteId} />
  );
}

export default function CocinaPage() {
  return (
    <Suspense fallback={<CocinaSkeleton />}>
      <CocinaContent />
    </Suspense>
  );
}
