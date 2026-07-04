import { Suspense } from 'react';
import { db } from '@/shared/db';
import { restaurantes } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ensureAmbientePorDefecto, getPlanoData } from '@/features/mesas/plano-data';
import { PlanoManager } from './plano-manager';
import { Skeleton } from '@/shared/ui/skeleton';

function PlanoSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
      {/* Canvas area */}
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}

async function PlanoContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  // Garantiza un ambiente por defecto y reubica mesas sin asignar
  await ensureAmbientePorDefecto(session.restauranteId);

  // Datos iniciales del plano (mismo loader que usa el refetch en cliente)
  const planoData = await getPlanoData(session.restauranteId);

  // Origin público (subdominio del tenant) para los QR de las mesas
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
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-6">Plano del local</h1>
      <PlanoManager
        ambientes={planoData.ambientes}
        mesas={planoData.mesas}
        elementos={planoData.elementos}
        origin={origin}
        userRole={session.role}
        tenantId={session.restauranteId}
      />
    </div>
  );
}

export default function PlanoPage() {
  return (
    <Suspense fallback={<PlanoSkeleton />}>
      <PlanoContent />
    </Suspense>
  );
}
