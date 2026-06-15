import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getReporteAction } from '@/features/reportes/reportes-actions';
import { ReportesManager } from './reportes-manager';

/** Devuelve la fecha (YYYY-MM-DD) en horario de Buenos Aires. */
function fechaBA(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export default async function ReportesPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'reports')) {
    redirect('/unauthorized');
  }

  const ahora = new Date();
  const hasta = fechaBA(ahora);
  const desde = fechaBA(new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000));

  const initialData = await getReporteAction(session.restauranteId, desde, hasta);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reportes</h1>
        <p className="text-gray-500">
          Ventas, productos y ocupación del local. Elegí el rango de fechas para analizar.
        </p>
      </div>

      <ReportesManager
        initialData={initialData}
        tenantId={session.restauranteId}
        desdeInicial={desde}
        hastaInicial={hasta}
      />
    </div>
  );
}
