'use server';

import { db } from '@/shared/db';
import { itemsBorradorMesa, transaccionesPago } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { crearPedidoConItems } from './crear-pedido-core';

type ModificadorSnapshot = {
  id: string;
  nombre: string;
  precioExtra: number;
};

/**
 * Reads items directly from the items_borrador_mesa table for the given session,
 * creates the pedido + comanda_items + modifiers, and then clears the borrador.
 * All within a single transaction for consistency.
 */
export async function enviarPedidoAction(
  tenantId: string, 
  sesionMesaId: string, 
  notas?: string
) {
  try {
    // 1. Read the current borrador items from the DB
    const borradorItems = await db
      .select()
      .from(itemsBorradorMesa)
      .where(eq(itemsBorradorMesa.sesionMesaId, sesionMesaId));

    if (!borradorItems.length) {
      return { success: false, message: 'El carrito está vacío' };
    }

    // 2. Process within a transaction
    const resultado = await db.transaction(async (tx) => {
      const { pedidoId, totalPedido } = await crearPedidoConItems(tx, {
        tenantId,
        sesionMesaId,
        notas,
        items: borradorItems.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          modificadores: ((item.modificadores as ModificadorSnapshot[]) || []).map((m) => ({ id: m.id })),
        })),
      });

      // Clear the borrador (this triggers Realtime → all devices see empty cart)
      await tx.delete(itemsBorradorMesa)
        .where(eq(itemsBorradorMesa.sesionMesaId, sesionMesaId));

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

    if (resultado.updatedPendingTx) {
      try {
        const supabase = await createSupabaseServerClient();
        const channel = supabase.channel(`admin_restaurant_${tenantId}`);
        await channel.send({
          type: 'broadcast',
          event: 'cuenta_solicitada', // Reusing this event to trigger a refresh on admin panel
          payload: {
            sesionMesaId,
          },
        });
      } catch (realtimeError) {
        console.warn('[enviarPedidoAction] Error enviando notificación realtime:', realtimeError);
      }
    }

    return { success: true, ...resultado };
  } catch (error: any) {
    console.error('[enviarPedidoAction]', error);
    return { success: false, message: error.message || 'Error al enviar pedido' };
  }
}
