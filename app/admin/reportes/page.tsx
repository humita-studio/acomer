import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getReporteAction } from '@/features/reportes/reportesActions';
import { ReportesManager } from '@/features/reportes/components/ReportesManager';
import { Skeleton } from '@/shared/ui/skeleton';

/** Devuelve la fecha (YYYY-MM-DD) en horario de Buenos Aires. */
function fechaBA(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function ReportesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        {/* Date range picker */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

async function ReportesContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'reports')) {
    redirect('/unauthorized');
  }

  const ahora = new Date();
  const hoy = fechaBA(ahora);
  const desde = fechaBA(new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000));

  const initialData = await getReporteAction(desde, hoy);

  return (
    <ReportesManager
      initialData={initialData}
      tenantId={session.restauranteId}
      hoy={hoy}
      desdeInicial={desde}
      hastaInicial={hoy}
    />
  );
}

export default function ReportesPage() {
  return (
    <Suspense fallback={<ReportesSkeleton />}>
      <ReportesContent />
    </Suspense>
  );
}
