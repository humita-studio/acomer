import { getCurrentSession } from '@/features/auth/session';
import { getDashboardMetricsAction } from '@/features/dashboard/dashboard-actions';
import { DashboardMetrics } from './dashboard-metrics';

export default async function AdminPage() {
  const session = await getCurrentSession();

  const metrics = session
    ? await getDashboardMetricsAction(session.restauranteId)
    : null;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Bienvenido al Panel de Control</h1>

      {session && metrics && (
        <DashboardMetrics
          initialData={metrics}
          tenantId={session.restauranteId}
          role={session.role}
        />
      )}

      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-gray-700">
          <strong>Restaurante:</strong> {session?.nombreRestaurante}
        </p>
        <p className="text-gray-700">
          <strong>Tu rol:</strong> {session?.role}
        </p>
      </div>
    </div>
  );
}
