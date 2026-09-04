'use server';

import { itemsBorradorMesa, sesionesMesa, transaccionesPago } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { broadcastAdminEvent, broadcastMesaEvent } from '@/shared/supabase/broadcast';
import { withPublicTenant } from '@/shared/db/secure-wrapper';
import { crearPedidoConItems } from '@/features/pedidos/crearPedidoCore';

type ModificadorSnapshot = {
  id: string;
  nombre: string;
  precioExtra: number;
};

/**
 * Reads and clears items directly from the items_borrador_mesa table atomically,
 * creates the pedido + comanda_items + modifiers, and notifies both staff and table.
 * All within a single transaction for concurrency safety.
 */
export async function enviarPedidoAction(
  tenantId: string, 
  sesionMesaId: string, 
  notas?: string
) {
  try {
    const resultado = await withPublicTenant(tenantId, async (tx) => {
      // 1. Validar que la sesión pertenece a este restaurante y está activa
      const [sesion] = await tx
        .select({ id: sesionesMesa.id })
        .from(sesionesMesa)
        .where(
          and(
            eq(sesionesMesa.id, sesionMesaId),
            eq(sesionesMesa.restauranteId, tenantId),
            eq(sesionesMesa.estado, 'Activa'),
          )
        )
        .limit(1);

      if (!sesion) {
        throw new Error('La mesa no tiene una sesión activa');
      }

      // 2. Consumir atómicamente el borrador (DELETE ... RETURNING)
      // Si dos comensales confirman en paralelo, solo uno obtiene los ítems
      const borradorItems = await tx
        .delete(itemsBorradorMesa)
        .where(eq(itemsBorradorMesa.sesionMesaId, sesionMesaId))
        .returning();

      if (!borradorItems.length) {
        throw new Error('El carrito está vacío o el pedido ya fue enviado');
      }

      // 3. Crear pedido con snapshots de precios desde la DB
      const { pedidoId, totalPedido } = await crearPedidoConItems(tx, {
        tenantId,
        sesionMesaId,
        notas,
        items: borradorItems.map((item) => ({
          productoId: item.productoId,
          varianteId: item.varianteId,
          cantidad: item.cantidad,
          modificadores: ((item.modificadores as ModificadorSnapshot[]) || []).map((m) => ({ id: m.id })),
        })),
      });

      // If there is any pending payment transaction, update its amount or cancel if it's digital
      const pendingTxs = await tx.select({ 
        id: transaccionesPago.id, 
        monto: transaccionesPago.monto,
        proveedor: transaccionesPago.proveedor 
      })
        .from(transaccionesPago)
        .where(
          and(
            eq(transaccionesPago.sesionMesaId, sesionMesaId),
            eq(transaccionesPago.estado, 'Pendiente')
          )
        );

      let updatedPendingTx = false;
      for (const pTx of pendingTxs) {
        if (pTx.proveedor === 'mercado_pago') {
          // Digital payment links can't be easily updated, so we cancel them to force generation of a new one
          await tx.update(transaccionesPago)
            .set({ estado: 'Cancelado' })
            .where(eq(transaccionesPago.id, pTx.id));
        } else {
          // Physical payments just get their expected amount updated
          const newTotal = parseFloat(pTx.monto?.toString() || '0') + totalPedido;
          await tx.update(transaccionesPago)
            .set({ monto: newTotal.toString() })
            .where(eq(transaccionesPago.id, pTx.id));
        }
        updatedPendingTx = true;
      }

      return { pedidoId, totalPedido, updatedPendingTx };
    });

    // Siempre avisamos al panel (cocina + campana) y a los demás comensales de
    // la mesa. Si además se tocó un cobro pendiente, reutilizamos el evento de
    // cuenta para refrescar cobros.
    const avisos = [
      broadcastAdminEvent(tenantId, 'nuevo_pedido', { sesionMesaId, pedidoId: resultado.pedidoId }),
      broadcastMesaEvent(sesionMesaId, 'pedido_confirmado', { pedidoId: resultado.pedidoId }),
    ];
    if (resultado.updatedPendingTx) {
      avisos.push(broadcastAdminEvent(tenantId, 'cobro_actualizado', { sesionMesaId }));
    }
    await Promise.all(avisos);

    return { success: true, ...resultado };
  } catch (error) {
    console.error('[enviarPedidoAction]', error);
    const message = error instanceof Error ? error.message : 'Error al enviar pedido';
    return { success: false, message };
  }
}
