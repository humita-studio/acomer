import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getOrdenesExternasAction } from '@/features/comanda/pedido-externo-actions';
import { PedidosOnlineManager } from './pedidos-online-manager';

export default async function PedidosOnlinePage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'delivery')) redirect('/unauthorized');

  const res = await getOrdenesExternasAction();
  const ordenes = res.success ? res.ordenes : [];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pedidos online</h1>
          <p className="text-gray-500">Retiros y envíos. Avanzá el estado de cada pedido hasta entregarlo.</p>
        </div>
        <Link
          href="/admin/pedidos-online/configuracion"
          className="shrink-0 text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
        >
          Configuración
        </Link>
      </div>

      <PedidosOnlineManager tenantId={session.restauranteId} initialOrdenes={ordenes as never} />
    </div>
  );
}
