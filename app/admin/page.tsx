import { getCurrentSession } from '@/features/auth/session';
import { getDashboardMetricsAction } from '@/features/dashboard/dashboardActions';
import { DashboardMetrics } from '@/features/dashboard/components/DashboardMetrics';

const TZ = 'America/Argentina/Buenos_Aires';

function saludo(hora: number): string {
  if (hora >= 6 && hora < 13) return 'Buen día';
  if (hora >= 13 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export default async function AdminPage() {
  const session = await getCurrentSession();

  const metrics = session
    ? await getDashboardMetricsAction(session.restauranteId)
    : null;

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

  return (
    <DashboardMetrics
      initialData={metrics}
      tenantId={session.restauranteId}
      role={session.role}
      saludo={saludo(horaBA)}
      fecha={fechaLarga}
      nombreRestaurante={session.nombreRestaurante}
    />
  );
}
