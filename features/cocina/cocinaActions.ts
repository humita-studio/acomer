'use server';

import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  comandaItemModificadores,
  comandaItems,
  datosEntrega,
  mesas,
  pedidos,
  sesionesMesa,
  transaccionesPago,
} from '@/shared/db/schema';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { cocinaAEntrega } from '@/features/pedidos/estadoSync';
import type { EstadoPedidoCocina, PedidoCocina } from './types';

const ESTADOS_ACTIVOS: EstadoPedidoCocina[] = ['Pendiente', 'En Preparación', 'Listo'];
/** Cerrados: salen del KDS y entran al historial del día. */
const ESTADOS_HISTORIAL: EstadoPedidoCocina[] = ['Entregado', 'Cancelado', 'Pagado'];

// Día operativo en horario de Buenos Aires (igual que dashboard/reportes).
const INICIO_HOY = sql`(date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')) AT TIME ZONE 'America/Argentina/Buenos_Aires'`;
const FIN_HOY = sql`${INICIO_HOY} + interval '1 day'`;

type CocinaRow = {
  id: string;
  estado: string;
  total: string | number;
  notas: string | null;
  createdAt: Date;
  sesionMesaId: string;
  tipoSesion: string | null;
  mesaIdentificador: string | null;
};

function requireCocinaSession() {
  return getCurrentSession().then((session) => {
    if (
      !session ||
      (!hasPermission(session.role, 'canViewKanban') &&
        !hasPermission(session.role, 'canAcceptOrders'))
    ) {
      return null;
    }
    return session;
  });
}

function etiquetaOrigen(tipoSesion: string | null, mesaIdentificador: string | null): string {
  const tipo = tipoSesion || 'salon';
  if (tipo === 'takeaway') return 'Takeaway';
  if (tipo === 'delivery') return 'Delivery';
  if (tipo === 'mostrador') return 'Mostrador';
  if (mesaIdentificador && tipo === 'salon') return mesaIdentificador;
  return mesaIdentificador || 'Mesa';
}

/** Cliente Drizzle dentro de withTenant (tx o db scoped). */
type DbScoped = {
  select: typeof import('@/shared/db').db.select;
};

/** Hidrata filas de pedido → modelo de UI (ítems, mods, flag pagado). */
async function hidratarPedidosCocina(
  db: DbScoped,
  tenantId: string,
  rows: CocinaRow[],
): Promise<PedidoCocina[]> {
  if (rows.length === 0) return [];

  const pedidoIds = rows.map((r) => r.id);
  const sesionIds = Array.from(new Set(rows.map((r) => r.sesionMesaId)));

  const cobrosAprobados =
    sesionIds.length === 0
      ? ([] as { sesionMesaId: string }[])
      : await db
          .select({ sesionMesaId: transaccionesPago.sesionMesaId })
          .from(transaccionesPago)
          .where(
            and(
              eq(transaccionesPago.restauranteId, tenantId),
              inArray(transaccionesPago.sesionMesaId, sesionIds),
              eq(transaccionesPago.estado, 'Aprobado'),
            ),
          );
  const sesionesPagadas = new Set(cobrosAprobados.map((c) => c.sesionMesaId));

  const items = await db
    .select({
      id: comandaItems.id,
      pedidoId: comandaItems.pedidoId,
      nombre: comandaItems.nombreProductoSnapshot,
      cantidad: comandaItems.cantidad,
    })
    .from(comandaItems)
    .where(
      and(eq(comandaItems.restauranteId, tenantId), inArray(comandaItems.pedidoId, pedidoIds)),
    );

  const itemIds = items.map((i) => i.id);
  const mods =
    itemIds.length === 0
      ? ([] as { comandaItemId: string; nombre: string }[])
      : await db
          .select({
            comandaItemId: comandaItemModificadores.comandaItemId,
            nombre: comandaItemModificadores.nombreModificadorSnapshot,
          })
          .from(comandaItemModificadores)
          .where(inArray(comandaItemModificadores.comandaItemId, itemIds));

  const modsByItem = new Map<string, string[]>();
  for (const m of mods) {
    const list = modsByItem.get(m.comandaItemId) ?? [];
    list.push(m.nombre);
    modsByItem.set(m.comandaItemId, list);
  }

  const itemsByPedido = new Map<string, PedidoCocina['items']>();
  for (const it of items) {
    const list = itemsByPedido.get(it.pedidoId) ?? [];
    list.push({
      id: it.id,
      nombre: it.nombre,
      cantidad: Number(it.cantidad),
      modificadores: modsByItem.get(it.id) ?? [],
    });
    itemsByPedido.set(it.pedidoId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    estado: r.estado as EstadoPedidoCocina,
    total: Number(r.total),
    notas: r.notas,
    createdAt: r.createdAt.toISOString(),
    etiquetaOrigen: etiquetaOrigen(r.tipoSesion, r.mesaIdentificador),
    tipoSesion: r.tipoSesion || 'salon',
    pagado: sesionesPagadas.has(r.sesionMesaId),
    items: itemsByPedido.get(r.id) ?? [],
  }));
}

/**
 * Pedidos activos de **hoy** (AR) para el KDS.
 * Solo cola de trabajo: Pendiente / En prep. / Listo.
 * Los de días anteriores no entran (evita basura en el tablero).
 */
export async function getPedidosCocinaAction(): Promise<PedidoCocina[]> {
  const session = await requireCocinaSession();
  if (!session) return [];

  const tenantId = session.restauranteId;

  try {
    return await withTenant(claimsFromSession(session), async (db) => {
      const rows: CocinaRow[] = await db
        .select({
          id: pedidos.id,
          estado: pedidos.estado,
          total: pedidos.total,
          notas: pedidos.notas,
          createdAt: pedidos.createdAt,
          sesionMesaId: pedidos.sesionMesaId,
          tipoSesion: sesionesMesa.tipo,
          mesaIdentificador: mesas.identificador,
        })
        .from(pedidos)
        .innerJoin(sesionesMesa, eq(pedidos.sesionMesaId, sesionesMesa.id))
        .leftJoin(mesas, eq(sesionesMesa.mesaId, mesas.id))
        .where(
          and(
            eq(pedidos.restauranteId, tenantId),
            inArray(pedidos.estado, ESTADOS_ACTIVOS),
            sql`${pedidos.createdAt} >= ${INICIO_HOY}`,
          ),
        )
        .orderBy(desc(pedidos.createdAt))
        .limit(100);

      return hidratarPedidosCocina(db, tenantId, rows);
    });
  } catch (error) {
    console.error('[getPedidosCocinaAction]', error);
    return [];
  }
}

/**
 * Historial del día (AR): pedidos ya cerrados (Entregado / Cancelado / Pagado).
 * Para revisar qué salió, no para operar.
 */
export async function getHistorialCocinaHoyAction(): Promise<PedidoCocina[]> {
  const session = await requireCocinaSession();
  if (!session) return [];

  const tenantId = session.restauranteId;

  try {
    return await withTenant(claimsFromSession(session), async (db) => {
      const rows: CocinaRow[] = await db
        .select({
          id: pedidos.id,
          estado: pedidos.estado,
          total: pedidos.total,
          notas: pedidos.notas,
          createdAt: pedidos.createdAt,
          sesionMesaId: pedidos.sesionMesaId,
          tipoSesion: sesionesMesa.tipo,
          mesaIdentificador: mesas.identificador,
        })
        .from(pedidos)
        .innerJoin(sesionesMesa, eq(pedidos.sesionMesaId, sesionesMesa.id))
        .leftJoin(mesas, eq(sesionesMesa.mesaId, mesas.id))
        .where(
          and(
            eq(pedidos.restauranteId, tenantId),
            inArray(pedidos.estado, ESTADOS_HISTORIAL),
            sql`${pedidos.createdAt} >= ${INICIO_HOY}`,
            sql`${pedidos.createdAt} < ${FIN_HOY}`,
          ),
        )
        .orderBy(desc(pedidos.createdAt))
        .limit(150);

      return hidratarPedidosCocina(db, tenantId, rows);
    });
  } catch (error) {
    console.error('[getHistorialCocinaHoyAction]', error);
    return [];
  }
}

/** Movimientos permitidos en el KDS (botón o drag & drop entre columnas). */
const TRANSICIONES: Record<string, EstadoPedidoCocina[]> = {
  Pendiente: ['En Preparación', 'Listo'],
  'En Preparación': ['Listo', 'Pendiente'],
  Listo: ['Entregado', 'En Preparación', 'Pendiente'],
};

export async function avanzarPedidoCocinaAction(
  pedidoId: string,
  nuevoEstado: EstadoPedidoCocina,
): Promise<{ success: boolean; message: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: 'No autorizado' };

  const puedeCocina = hasPermission(session.role, 'canAcceptOrders');
  const puedeEntregar = hasPermission(session.role, 'canMarkDelivered');

  if (nuevoEstado === 'Entregado' && !puedeEntregar && !puedeCocina) {
    return { success: false, message: 'No autorizado' };
  }
  if (nuevoEstado !== 'Entregado' && !puedeCocina && !puedeEntregar) {
    return { success: false, message: 'No autorizado' };
  }

  const tenantId = session.restauranteId;

  try {
    const result = await withTenant(claimsFromSession(session), async (db) => {
      const [pedido] = await db
        .select({
          id: pedidos.id,
          estado: pedidos.estado,
          sesionMesaId: pedidos.sesionMesaId,
        })
        .from(pedidos)
        .where(and(eq(pedidos.id, pedidoId), eq(pedidos.restauranteId, tenantId)))
        .limit(1);

      if (!pedido) return { success: false, message: 'Pedido no encontrado' };

      const permitidos = TRANSICIONES[pedido.estado] ?? [];
      if (!permitidos.includes(nuevoEstado)) {
        return {
          success: false,
          message: `No se puede pasar de ${pedido.estado} a ${nuevoEstado}`,
        };
      }

      await db
        .update(pedidos)
        .set({ estado: nuevoEstado, updatedAt: new Date() })
        .where(
          and(
            eq(pedidos.id, pedidoId),
            eq(pedidos.restauranteId, tenantId),
            ne(pedidos.estado, 'Cancelado'),
          ),
        );

      // Flujo e2e online: al mover en cocina, el seguimiento del comensal y el
      // tablero de pedidos-online leen `datos_entrega.estado_entrega`.
      const [sesion] = await db
        .select({ tipo: sesionesMesa.tipo })
        .from(sesionesMesa)
        .where(
          and(eq(sesionesMesa.id, pedido.sesionMesaId), eq(sesionesMesa.restauranteId, tenantId)),
        )
        .limit(1);

      let estadoEntrega: string | null = null;
      const esExterno = sesion?.tipo === 'takeaway' || sesion?.tipo === 'delivery';
      if (esExterno) {
        estadoEntrega = cocinaAEntrega(nuevoEstado);
        if (estadoEntrega) {
          await db
            .update(datosEntrega)
            .set({ estadoEntrega, updatedAt: new Date() })
            .where(
              and(
                eq(datosEntrega.sesionMesaId, pedido.sesionMesaId),
                eq(datosEntrega.restauranteId, tenantId),
              ),
            );

          // Entregado/Cancelado cierran la sesión externa (mismo criterio que delivery).
          if (estadoEntrega === 'Entregado' || estadoEntrega === 'Cancelado') {
            await db
              .update(sesionesMesa)
              .set({ estado: 'Cerrada', updatedAt: new Date() })
              .where(
                and(
                  eq(sesionesMesa.id, pedido.sesionMesaId),
                  eq(sesionesMesa.restauranteId, tenantId),
                ),
              );
          }
        }
      }

      return {
        success: true,
        message: 'Estado actualizado',
        sesionMesaId: pedido.sesionMesaId,
        estadoEntrega,
        esExterno,
      };
    });

    if (result.success && 'sesionMesaId' in result) {
      try {
        const supabase = await createSupabaseServerClient();
        const adminChannel = supabase.channel(`admin_restaurant_${tenantId}`);
        await adminChannel.send({
          type: 'broadcast',
          event: 'pedido_estado',
          payload: {
            pedidoId,
            estado: nuevoEstado,
            sesionMesaId: result.sesionMesaId,
          },
        });
        if (result.esExterno && result.estadoEntrega) {
          await adminChannel.send({
            type: 'broadcast',
            event: 'orden_externa_actualizada',
            payload: {
              sesionMesaId: result.sesionMesaId,
              estadoEntrega: result.estadoEntrega,
            },
          });
          await supabase.channel(`mesa_${result.sesionMesaId}`).send({
            type: 'broadcast',
            event: 'estado_entrega_actualizado',
            payload: { estadoEntrega: result.estadoEntrega },
          });
        }
      } catch {
        // best-effort
      }
    }

    return { success: result.success, message: result.message };
  } catch (error) {
    console.error('[avanzarPedidoCocinaAction]', error);
    return { success: false, message: 'Error al actualizar el pedido' };
  }
}
