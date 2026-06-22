import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getCajaActualAction, getHistorialCajasAction } from '@/features/caja/cajaActions';
import { CajaManager } from '@/features/caja/components/CajaManager';

export default async function CajaPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'cashier')) {
    redirect('/unauthorized');
  }

  const [initialCaja, initialHistorial] = await Promise.all([
    getCajaActualAction(session.restauranteId),
    getHistorialCajasAction(session.restauranteId),
  ]);

  return (
    <CajaManager
      initialCaja={initialCaja}
      initialHistorial={initialHistorial}
      tenantId={session.restauranteId}
    />
  );
}
