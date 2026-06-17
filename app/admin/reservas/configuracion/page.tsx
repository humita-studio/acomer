import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getReservasConfigAction } from '@/features/reservas/reservas-config-actions';
import { ReservasConfigForm } from './reservas-config-form';

export default async function ReservasConfigPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'reservas')) redirect('/unauthorized');

  const res = await getReservasConfigAction();

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link href="/admin/reservas" className="text-sm text-blue-600 hover:underline">
          ← Volver a reservas
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-2">Configuración de reservas</h1>
        <p className="text-gray-500">
          Definí los turnos, la duración por defecto y los cupos. Los cupos vacíos significan “sin
          límite”.
        </p>
      </div>

      <ReservasConfigForm initialConfig={res.config} />
    </div>
  );
}
