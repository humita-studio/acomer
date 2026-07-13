import { Suspense } from 'react';
import { headers } from 'next/headers';
import { getCurrentSession } from '@/features/auth/session';
import { getDashboardMetricsAction } from '@/features/dashboard/dashboardActions';
import { getOnboardingStatusAction } from '@/features/dashboard/onboardingActions';
import { DashboardMetrics } from '@/features/dashboard/components/DashboardMetrics';
import { Skeleton } from '@/shared/ui/skeleton';

const TZ = 'America/Argentina/Buenos_Aires';

function saludo(hora: number): string {
  if (hora >= 6 && hora < 13) return 'Buen día';
  if (hora >= 13 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Saludo + fecha */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* Onboarding skeleton */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

async function DashboardContent() {
  const session = await getCurrentSession();

  const [metrics, onboarding, headersList] = session
    ? await Promise.all([
        getDashboardMetricsAction(),
        getOnboardingStatusAction(),
        headers(),
      ])
    : [null, null, null];

  const ahora = new Date();
  const horaBA = Number(
    ahora.toLocaleString('es-AR', { timeZone: TZ, hour: 'numeric', hour12: false })
  );
  const fechaLarga = ahora.toLocaleDateString('es-AR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (!session || !metrics) {
    return null;
  }

  // Dominio base para el link público del local (sin subdominio de tenant).
  const host = headersList?.get('host') || '';
  const dominioPublico = host.replace(/^app\./, '') || undefined;

  return (
    <DashboardMetrics
      initialData={metrics}
      tenantId={session.restauranteId}
      role={session.role}
      saludo={saludo(horaBA)}
      fecha={fechaLarga}
      nombreRestaurante={session.nombreRestaurante}
      onboarding={onboarding}
      dominioPublico={dominioPublico}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
