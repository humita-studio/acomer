import { Suspense } from 'react';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/features/authorization/roles';
import { getTransaccionesPendientesAction } from '@/features/cobros/cobrosActions';
import { CobrosManager } from '@/features/cobros/components/CobrosManager';
import { Skeleton } from '@/shared/ui/skeleton';

function CobrosSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function CobrosContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'cashier')) {
    redirect('/unauthorized');
  }

  const initialTransacciones = await getTransaccionesPendientesAction(session.restauranteId);

  return (
    <CobrosManager
      initialTransacciones={initialTransacciones}
      tenantId={session.restauranteId}
    />
  );
}

export default function CobrosPage() {
  return (
    <Suspense fallback={<CobrosSkeleton />}>
      <CobrosContent />
    </Suspense>
  );
}
