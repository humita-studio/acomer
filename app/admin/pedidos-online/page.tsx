import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getOrdenesExternasAction } from '@/features/pedidos-online/pedidoExternoActions';
import { getDeliveryConfigAction } from '@/features/pedidos-online/deliveryConfigActions';
import { PedidosOnlineManager } from '@/features/pedidos-online/components/PedidosOnlineManager';

export default async function PedidosOnlinePage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'delivery')) redirect('/unauthorized');

  const [ordenesRes, configRes] = await Promise.all([
    getOrdenesExternasAction(),
    getDeliveryConfigAction(),
  ]);
  const ordenes = ordenesRes.success ? ordenesRes.ordenes : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Pedidos online</h1>
        <p className="text-muted-foreground">
          Retiros y envíos. Avanzá el estado de cada pedido hasta entregarlo.
        </p>
      </div>

      <PedidosOnlineManager
        tenantId={session.restauranteId}
        initialOrdenes={ordenes as never}
        initialConfig={configRes.config}
      />
    </div>
  );
}
