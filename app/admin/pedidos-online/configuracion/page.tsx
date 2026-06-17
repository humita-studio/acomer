import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getDeliveryConfigAction } from '@/features/comanda/delivery-config-actions';
import { DeliveryConfigForm } from './delivery-config-form';

export default async function DeliveryConfigPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'delivery')) redirect('/unauthorized');

  const res = await getDeliveryConfigAction();

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link href="/admin/pedidos-online" className="text-sm text-blue-600 hover:underline">
          ← Volver a pedidos online
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-2">Configuración de pedidos online</h1>
        <p className="text-gray-500">
          Elegí qué modalidades ofrecés y hasta cuándo el cliente puede agregar productos a un pedido
          ya confirmado.
        </p>
      </div>

      <DeliveryConfigForm initialConfig={res.config} />
    </div>
  );
}
