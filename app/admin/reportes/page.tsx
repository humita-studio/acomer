import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getReporteAction } from '@/features/reportes/reportesActions';
import { ReportesManager } from '@/features/reportes/components/ReportesManager';

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
  const hoy = fechaBA(ahora);
  const desde = fechaBA(new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000));

  const initialData = await getReporteAction(session.restauranteId, desde, hoy);

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
