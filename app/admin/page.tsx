import { getCurrentSession } from '@/features/auth/session';
import { getDashboardMetricsAction } from '@/features/dashboard/dashboard-actions';
import { DashboardMetrics } from './dashboard-metrics';

export default async function AdminPage() {
  const session = await getCurrentSession();

  const metrics = session
    ? await getDashboardMetricsAction(session.restauranteId)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bienvenido al Panel de Control</h1>
        <p className="text-sm text-muted-foreground">
          {session?.nombreRestaurante} · <span className="capitalize">{session?.role}</span>
        </p>
      </div>

      {session && metrics && (
        <DashboardMetrics
          initialData={metrics}
          tenantId={session.restauranteId}
          role={session.role}
        />
      )}
    </div>
  );
}
