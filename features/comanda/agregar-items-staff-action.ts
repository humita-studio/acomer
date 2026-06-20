'use server';

import { db } from '@/shared/db';
import {
  pedidos,
  comandaItems,
  comandaItemModificadores,
  productos,
  productosPrecios,
  modificadores,
  modificadoresPrecios,
  transaccionesPago,
} from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { createSupabaseServerClient } from '@/shared/supabase/server';

export type StaffItemInput = {
  /** `null` para un ítem libre (algo que no está en la carta). */
  productoId: string | null;
  cantidad: number;
  modificadorIds?: string[];
  /** Solo para ítems libres: nombre y precio cargados a mano. */
  nombreLibre?: string;
  precioLibre?: number;
};

/** Un ítem libre no referencia un producto: trae nombre + precio propios. */
function esItemLibre(i: StaffItemInput): boolean {
  return !i.productoId && typeof i.nombreLibre === 'string' && i.nombreLibre.trim().length > 0;
}

/**
 * El mozo (o admin/owner) carga productos al ticket de una mesa desde el panel.
 *
 * Crea un pedido confirmado directo a partir de los items recibidos —sin pasar
 * por el borrador compartido del comensal—, snapshoteando nombre y precio
 * vigentes, y lo suma a la cuenta de la sesión. Reusa la misma lógica de
 * snapshot que `enviarPedidoAction`.
 */
export async function agregarItemsStaffAction(
  sesionMesaId: string,
  items: StaffItemInput[],
) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canTakeOrders')) {
      return { success: false, message: 'No tenés permiso para cargar pedidos' };
    }
    const tenantId = session.restauranteId;

    const itemsValidos = items.filter(
      (i) => i.cantidad > 0 && (i.productoId || (esItemLibre(i) && Number(i.precioLibre) > 0)),
    );
    if (!itemsValidos.length) {
      return { success: false, message: 'No hay productos para agregar' };
    }

    const resultado = await db.transaction(async (tx) => {
      let totalPedido = 0;

      const nuevoPedido = await tx
        .insert(pedidos)
        .values({
          restauranteId: tenantId,
          sesionMesaId,
          estado: 'Pendiente',
          total: '0',
        })
        .returning({ id: pedidos.id });
      const pedidoId = nuevoPedido[0].id;

      for (const item of itemsValidos) {
        // Ítem libre: no hay producto de la carta. Se inserta con productoId
        // null y los snapshots de nombre/precio cargados a mano. No admite
        // modificadores.
        if (esItemLibre(item)) {
          const precioLibre = Number(item.precioLibre) || 0;
          const nombreLibre = item.nombreLibre!.trim().slice(0, 120);
          await tx.insert(comandaItems).values({
            restauranteId: tenantId,
            pedidoId,
            productoId: null,
            cantidad: item.cantidad.toString(),
            nombreProductoSnapshot: nombreLibre,
            precioUnitarioSnapshot: precioLibre.toString(),
          });
          totalPedido += precioLibre * item.cantidad;
          continue;
        }

        // A esta altura no es ítem libre, así que productoId está presente.
        const productoId = item.productoId as string;

        // Snapshot del nombre del producto (validando que sea del tenant)
        const prodData = await tx
          .select({ nombre: productos.nombre })
          .from(productos)
          .where(and(eq(productos.id, productoId), eq(productos.restauranteId, tenantId)))
          .limit(1);
        if (!prodData[0]) throw new Error(`Producto no encontrado: ${productoId}`);

        // Precio vigente
        const precioData = await tx
          .select({ precio: productosPrecios.precio })
          .from(productosPrecios)
          .where(and(eq(productosPrecios.productoId, productoId), isNull(productosPrecios.vigentaHsta)))
          .limit(1);
        const precioProducto = parseFloat(precioData[0]?.precio?.toString() || '0');

        let subtotalItem = precioProducto * item.cantidad;

        const nuevoComandaItem = await tx
          .insert(comandaItems)
          .values({
            restauranteId: tenantId,
            pedidoId,
            productoId: productoId,
            cantidad: item.cantidad.toString(),
            nombreProductoSnapshot: prodData[0].nombre,
            precioUnitarioSnapshot: precioProducto.toString(),
          })
          .returning({ id: comandaItems.id });
        const comandaItemId = nuevoComandaItem[0].id;

        for (const modId of item.modificadorIds || []) {
          const modData = await tx
            .select({ nombre: modificadores.nombre })
            .from(modificadores)
            .where(and(eq(modificadores.id, modId), eq(modificadores.restauranteId, tenantId)))
            .limit(1);
          if (!modData[0]) continue;

          const modPrecioData = await tx
            .select({ precioExtra: modificadoresPrecios.precioExtra })
            .from(modificadoresPrecios)
            .where(and(eq(modificadoresPrecios.modificadorId, modId), isNull(modificadoresPrecios.vigentaHsta)))
            .limit(1);
          const precioMod = parseFloat(modPrecioData[0]?.precioExtra?.toString() || '0');
          subtotalItem += precioMod * item.cantidad;

          await tx.insert(comandaItemModificadores).values({
            restauranteId: tenantId,
            comandaItemId,
            modificadorId: modId,
            nombreModificadorSnapshot: modData[0].nombre,
            precioExtraSnapshot: precioMod.toString(),
          });
        }

        totalPedido += subtotalItem;
      }

      await tx.update(pedidos).set({ total: totalPedido.toString() }).where(eq(pedidos.id, pedidoId));

      // Si hay una cuenta presencial pendiente, actualizar su monto.
      // Los links de Mercado Pago no se pueden editar, así que se cancelan
      // para forzar la regeneración con el nuevo total.
      const pendingTxs = await tx
        .select({
          id: transaccionesPago.id,
          monto: transaccionesPago.monto,
          proveedor: transaccionesPago.proveedor,
        })
        .from(transaccionesPago)
        .where(and(eq(transaccionesPago.sesionMesaId, sesionMesaId), eq(transaccionesPago.estado, 'Pendiente')));

      for (const pTx of pendingTxs) {
        if (pTx.proveedor === 'mercado_pago') {
          await tx.update(transaccionesPago).set({ estado: 'Cancelado' }).where(eq(transaccionesPago.id, pTx.id));
        } else {
          const newTotal = parseFloat(pTx.monto?.toString() || '0') + totalPedido;
          await tx.update(transaccionesPago).set({ monto: newTotal.toString() }).where(eq(transaccionesPago.id, pTx.id));
        }
      }

      return { pedidoId, totalPedido };
    });

    // Avisar al dispositivo del comensal para que refresque su ticket en vivo
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.channel(`mesa_${sesionMesaId}`).send({
        type: 'broadcast',
        event: 'ticket_actualizado',
        payload: { sesionMesaId },
      });
    } catch (realtimeError) {
      console.warn('[agregarItemsStaffAction] Error notificando realtime:', realtimeError);
    }

    return { success: true, ...resultado };
  } catch (error) {
    console.error('[agregarItemsStaffAction]', error);
    const message = error instanceof Error ? error.message : 'Error al agregar productos';
    return { success: false, message };
  }
}
