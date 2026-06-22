import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/shared/db';
import { mesas, sesionesMesa } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { obtenerTicketMesa } from '@/features/pedidos/obtenerTicketMesa';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import type { CategoriaMenu } from '@/features/carta/types';
import { MesaPedidoManager } from './mesa-pedido-manager';
import { AbrirMesaButton } from './abrir-mesa-button';

export default async function MesaPedidoPage({
  params,
}: {
  params: Promise<{ mesaId: string }>;
}) {
  const { mesaId } = await params;

  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'canTakeOrders')) redirect('/unauthorized');

  const tenantId = session.restauranteId;

  // 1. Mesa (del tenant)
  const mesaData = await db
    .select()
    .from(mesas)
    .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt)))
    .limit(1);
  const mesa = mesaData[0];
  if (!mesa) notFound();

  // 2. Sesión activa de la mesa
  const sesionData = await db
    .select()
    .from(sesionesMesa)
    .where(and(eq(sesionesMesa.mesaId, mesaId), eq(sesionesMesa.estado, 'Activa')))
    .limit(1);
  const sesion = sesionData[0];

  // 3. Ticket acumulado (si hay sesión)
  const ticket = sesion ? await obtenerTicketMesa(sesion.id) : { items: [], total: 0 };

  // 4. Catálogo activo (categorías + productos con adicionales y variantes)
  const { categorias: cats, productos: menuProductos } = await obtenerCarta(tenantId);

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/mesas" className="text-sm text-blue-600 hover:underline">
          ← Volver a Mesas
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-1">{mesa.identificador}</h1>
      </div>

      {!sesion ? (
        <AbrirMesaButton mesaId={mesa.id} />
      ) : (
        <MesaPedidoManager
          mesaId={mesa.id}
          sesionMesaId={sesion.id}
          categorias={cats as CategoriaMenu[]}
          productos={menuProductos}
          ticketInicial={ticket}
        />
      )}
    </div>
  );
}
