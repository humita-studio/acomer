'use server';

import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import {
  comandaItemModificadores,
  comandaItems,
  mesas,
  pedidos,
  sesionesMesa,
} from '@/shared/db/schema';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import type { EstadoPedidoCocina, PedidoCocina } from './types';

const ESTADOS_ACTIVOS: EstadoPedidoCocina[] = ['Pendiente', 'En Preparación', 'Listo'];

/**
 * Pedidos activos del local para el tablero de cocina (KDS).
 * Scopeado por tenant con RLS.
 */
export async function getPedidosCocinaAction(): Promise<PedidoCocina[]> {
  const session = await getCurrentSession();
  if (
    !session ||
    (!hasPermission(session.role, 'canViewKanban') &&
      !hasPermission(session.role, 'canAcceptOrders'))
  ) {
    return [];
  }

  const tenantId = session.restauranteId;

  try {
    return await withTenant(claimsFromSession(session), async (db) => {
      const rows = await db
        .select({
          id: pedidos.id,
          estado: pedidos.estado,
          total: pedidos.total,
          notas: pedidos.notas,
          createdAt: pedidos.createdAt,
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
          ),
        )
        .orderBy(desc(pedidos.createdAt))
        .limit(100);

      if (rows.length === 0) return [];

      const pedidoIds = rows.map((r) => r.id);
      const items = await db
        .select({
          id: comandaItems.id,
          pedidoId: comandaItems.pedidoId,
          nombre: comandaItems.nombreProductoSnapshot,
          cantidad: comandaItems.cantidad,
        })
        .from(comandaItems)
        .where(
          and(
            eq(comandaItems.restauranteId, tenantId),
            inArray(comandaItems.pedidoId, pedidoIds),
          ),
        );

      const itemIds = items.map((i) => i.id);
      const mods =
        itemIds.length === 0
          ? []
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

      return rows.map((r) => {
        const tipo = r.tipoSesion || 'salon';
        let etiquetaOrigen = r.mesaIdentificador || 'Mesa';
        if (tipo === 'takeaway') etiquetaOrigen = 'Takeaway';
        if (tipo === 'delivery') etiquetaOrigen = 'Delivery';
        if (tipo === 'mostrador') etiquetaOrigen = 'Mostrador';
        if (r.mesaIdentificador && tipo === 'salon') {
          etiquetaOrigen = r.mesaIdentificador;
        }

        return {
          id: r.id,
          estado: r.estado as EstadoPedidoCocina,
          total: Number(r.total),
          notas: r.notas,
          createdAt: r.createdAt.toISOString(),
          etiquetaOrigen,
          tipoSesion: tipo,
          items: itemsByPedido.get(r.id) ?? [],
        };
      });
    });
  } catch (error) {
    console.error('[getPedidosCocinaAction]', error);
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

      return {
        success: true,
        message: 'Estado actualizado',
        sesionMesaId: pedido.sesionMesaId,
      };
    });

    if (result.success && 'sesionMesaId' in result) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.channel(`admin_restaurant_${tenantId}`).send({
          type: 'broadcast',
          event: 'pedido_estado',
          payload: {
            pedidoId,
            estado: nuevoEstado,
            sesionMesaId: result.sesionMesaId,
          },
        });
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
