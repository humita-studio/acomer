import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/features/authorization/roles';
import { getTransaccionesPendientesAction } from '@/features/pagos/cobros-actions';
import { CobrosManager } from './cobros-manager';

export default async function CobrosPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'cashier')) {
    redirect('/unauthorized');
  }

  const initialTransacciones = await getTransaccionesPendientesAction(session.restauranteId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Caja / Cobros</h1>
        <p className="text-gray-500">Administrá los pagos en efectivo o tarjeta física solicitados desde las mesas.</p>
      </div>

      <CobrosManager 
        initialTransacciones={initialTransacciones} 
        tenantId={session.restauranteId} 
      />
    </div>
  );
}
