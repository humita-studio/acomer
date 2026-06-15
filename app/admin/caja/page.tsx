import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getCajaActualAction, getHistorialCajasAction } from '@/features/caja/caja-actions';
import { CajaManager } from './caja-manager';

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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Caja</h1>
        <p className="text-gray-500">
          Apertura, movimientos y arqueo del turno. El efectivo esperado incluye los cobros en
          efectivo aprobados durante la caja.
        </p>
      </div>

      <CajaManager
        initialCaja={initialCaja}
        initialHistorial={initialHistorial}
        tenantId={session.restauranteId}
      />
    </div>
  );
}
