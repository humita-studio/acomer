import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/shared/db';
import { mesas, sesionesMesa } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { obtenerTicketMesa } from '@/features/pedidos/obtenerTicketMesa';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import type { CategoriaMenu } from '@/features/carta/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { MesaPedidoManager } from '@/features/mesas/components/mesa-detalle/mesa-pedido-manager';
import { AbrirMesaButton } from '@/features/mesas/components/mesa-detalle/abrir-mesa-button';

function MesaDetalleSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

function minutosAbierta(inicio: Date | string | null | undefined): number | null {
  if (!inicio) return null;
  const ms = Date.now() - new Date(inicio).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.max(0, Math.round(ms / 60000));
}

async function MesaDetalleContent({ mesaId }: { mesaId: string }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'canTakeOrders')) redirect('/unauthorized');

  const tenantId = session.restauranteId;
  const canManage = hasPermission(session.role, 'canManageTables');

  const mesaData = await db
    .select()
    .from(mesas)
    .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt)))
    .limit(1);
  const mesa = mesaData[0];
  if (!mesa) notFound();

  const sesionData = await db
    .select()
    .from(sesionesMesa)
    .where(and(eq(sesionesMesa.mesaId, mesaId), eq(sesionesMesa.estado, 'Activa')))
    .limit(1);
  const sesion = sesionData[0];

  const ticket = sesion ? await obtenerTicketMesa(sesion.id) : { items: [], total: 0 };
  const { categorias: cats, productos: menuProductos } = await obtenerCarta(tenantId);

  const mins = minutosAbierta(sesion?.createdAt);
  const metaParts = [
    mins != null ? `Abierta hace ${mins} min` : null,
    mesa.capacidad ? `${mesa.capacidad} personas` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="outline" size="icon" className="mt-1 shrink-0" aria-label="Volver a mesas">
            <Link href="/admin/mesas">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {mesa.identificador}
              </h1>
              <Badge
                variant="secondary"
                className={
                  sesion
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-success-subtle text-success-foreground'
                }
              >
                <span
                  className={`mr-1.5 size-1.5 rounded-full ${sesion ? 'bg-primary' : 'bg-success'}`}
                />
                {sesion ? 'Ocupada' : 'Libre'}
              </Badge>
            </div>
            <p className="text-sm text-text-secondary">
              {metaParts.length > 0 ? metaParts.join(' · ') : 'Sin sesión activa'}
            </p>
          </div>
        </div>
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
          canLiberar={canManage}
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
