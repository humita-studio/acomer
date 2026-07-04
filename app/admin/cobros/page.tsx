import { Suspense } from 'react';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/features/authorization/roles';
import { getTransaccionesTableroAction } from '@/features/cobros/cobrosActions';
import { CobrosManager } from '@/features/cobros/components/CobrosManager';
import { Skeleton } from '@/shared/ui/skeleton';

function CobrosSkeleton() {
  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="flex flex-1 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex min-w-[340px] flex-1 flex-col gap-3 rounded-xl bg-muted p-3">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
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

  const initialTransacciones = await getTransaccionesTableroAction();

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
