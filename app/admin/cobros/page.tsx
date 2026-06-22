import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/features/authorization/roles';
import { getTransaccionesPendientesAction } from '@/features/cobros/cobrosActions';
import { CobrosManager } from '@/features/cobros/components/CobrosManager';

export default async function CobrosPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'cashier')) {
    redirect('/unauthorized');
  }

  const initialTransacciones = await getTransaccionesPendientesAction(session.restauranteId);

  return (
    <CobrosManager
      initialTransacciones={initialTransacciones}
      tenantId={session.restauranteId}
    />
  );
}
