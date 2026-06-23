import { Suspense } from 'react';
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
import { Skeleton } from '@/shared/ui/skeleton';

function MesaDetalleSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

async function MesaDetalleContent({ mesaId }: { mesaId: string }) {
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

export default async function MesaPedidoPage({
  params,
}: {
  params: Promise<{ mesaId: string }>;
}) {
  const { mesaId } = await params;

  return (
    <Suspense fallback={<MesaDetalleSkeleton />}>
      <MesaDetalleContent mesaId={mesaId} />
    </Suspense>
  );
}
