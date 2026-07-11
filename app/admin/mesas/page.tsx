import { Suspense } from 'react';
import { db } from '@/shared/db';
import { restaurantes } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
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

  await ensureAmbientePorDefecto(session.restauranteId);

  const planoData = await getPlanoData(session.restauranteId);

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const [tenant] = await db
    .select({ slug: restaurantes.slug })
    .from(restaurantes)
    .where(eq(restaurantes.id, session.restauranteId))
    .limit(1);
  const tenantSlug = tenant?.slug || 'demo';
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
