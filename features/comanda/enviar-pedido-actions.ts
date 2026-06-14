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
  itemsBorradorMesa,
  transaccionesPago
} from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/shared/supabase/server';

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
      let totalPedido = 0;
      
      // Create the pedido
      const nuevoPedido = await tx.insert(pedidos).values({
        restauranteId: tenantId,
        sesionMesaId: sesionMesaId,
        estado: 'Pendiente',
        notas: notas || null,
        total: '0',
      }).returning({ id: pedidos.id });
      
      const pedidoId = nuevoPedido[0].id;

      // Process each borrador item
      for (const item of borradorItems) {
        // Get product snapshot (nombre)
        const prodData = await tx.select({ nombre: productos.nombre })
          .from(productos)
          .where(eq(productos.id, item.productoId))
          .limit(1);
          
        if (!prodData[0]) throw new Error(`Producto no encontrado: ${item.productoId}`);

        // Get current price
        const precioData = await tx.select({ precio: productosPrecios.precio })
          .from(productosPrecios)
          .where(
            and(
              eq(productosPrecios.productoId, item.productoId),
              isNull(productosPrecios.vigentaHsta)
            )
          )
          .limit(1);
          
        const precioProducto = parseFloat(precioData[0]?.precio?.toString() || '0');
        
        let subtotalItem = precioProducto * item.cantidad;

        // Insert comanda item
        const nuevoComandaItem = await tx.insert(comandaItems).values({
          restauranteId: tenantId,
          pedidoId: pedidoId,
          productoId: item.productoId,
          cantidad: item.cantidad.toString(),
          nombreProductoSnapshot: prodData[0].nombre,
          precioUnitarioSnapshot: precioProducto.toString()
        }).returning({ id: comandaItems.id });
        
        const comandaItemId = nuevoComandaItem[0].id;

        // Process modifiers from the borrador JSONB
        const itemMods = (item.modificadores as ModificadorSnapshot[]) || [];
        for (const mod of itemMods) {
          const modData = await tx.select({ nombre: modificadores.nombre })
            .from(modificadores)
            .where(eq(modificadores.id, mod.id))
            .limit(1);
            
          if (!modData[0]) continue;

          const modPrecioData = await tx.select({ precioExtra: modificadoresPrecios.precioExtra })
            .from(modificadoresPrecios)
            .where(
              and(
                eq(modificadoresPrecios.modificadorId, mod.id),
                isNull(modificadoresPrecios.vigentaHsta)
              )
            )
            .limit(1);
            
          const precioMod = parseFloat(modPrecioData[0]?.precioExtra?.toString() || '0');
          subtotalItem += (precioMod * item.cantidad);

          await tx.insert(comandaItemModificadores).values({
            restauranteId: tenantId,
            comandaItemId: comandaItemId,
            modificadorId: mod.id,
            nombreModificadorSnapshot: modData[0].nombre,
            precioExtraSnapshot: precioMod.toString()
          });
        }

        totalPedido += subtotalItem;
      }

      // Update the pedido total
      await tx.update(pedidos)
        .set({ total: totalPedido.toString() })
        .where(eq(pedidos.id, pedidoId));

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
