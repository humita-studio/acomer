import { Suspense } from 'react';
import { canAccessSection } from '@/features/authorization/roles';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ensureAmbientePorDefecto, getPlanoData } from '@/features/mesas/plano-data';
import { PlanoManager } from '@/features/mesas/components/plano-manager';
import { Skeleton } from '@/shared/ui/skeleton';

function PlanoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Skeleton className="h-[560px] flex-1 rounded-xl" />
        <Skeleton className="h-[320px] w-full rounded-xl lg:w-[300px]" />
      </div>
    </div>
  );
}

async function PlanoContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  // Cocina no opera mesas (el sidebar ya lo oculta; esto cubre la URL directa).
  if (!canAccessSection(session.role, 'tables')) redirect('/unauthorized');

  // El ambiente por defecto (self-healing) y el plano se piden en paralelo: en
  // el caso normal el primero no escribe nada. Si tuvo que crear o reasignar,
  // releemos el plano ya consistente.
  const [ambiente, planoInicial, headersList] = await Promise.all([
    ensureAmbientePorDefecto(session.restauranteId),
    getPlanoData(session.restauranteId),
    headers(),
  ]);
  const planoData = ambiente.cambio ? await getPlanoData(session.restauranteId) : planoInicial;

  const host = headersList.get('host') || 'localhost:3000';
  const tenantSlug = session.slugRestaurante || 'demo';
  const origin = host.includes('localhost')
    ? `http://${tenantSlug}.localhost:3000`
    : `https://${tenantSlug}.${host.replace('app.', '')}`;

  return (
    <PlanoManager
      ambientes={planoData.ambientes}
      mesas={planoData.mesas}
      elementos={planoData.elementos}
      origin={origin}
      userRole={session.role}
      tenantId={session.restauranteId}
      currentUserId={session.user.id}
    />
  );
}

export default function PlanoPage() {
  return (
    <Suspense fallback={<PlanoSkeleton />}>
      <PlanoContent />
    </Suspense>
  );
}
