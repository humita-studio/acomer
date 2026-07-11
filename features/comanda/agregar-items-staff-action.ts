'use server';

import { transaccionesPago } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { crearPedidoConItemsStaff, esItemLibre, type StaffItemInput } from '@/features/pedidos/crearPedidoCore';

// Reexport para los consumidores históricos (p.ej. use-ticket-mesa).
export type { StaffItemInput };

/**
 * El mozo (o admin/owner) carga productos al ticket de una mesa desde el panel.
 *
 * Crea un pedido confirmado directo a partir de los items recibidos —sin pasar
 * por el borrador compartido del comensal—, snapshoteando nombre y precio
 * vigentes (vía `crearPedidoConItemsStaff`), y lo suma a la cuenta de la sesión.
 */
export async function agregarItemsStaffAction(
  sesionMesaId: string,
  items: StaffItemInput[],
  notas?: string | null,
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

    const resultado = await withTenant(claimsFromSession(session), async (tx) => {
      const { pedidoId, totalPedido } = await crearPedidoConItemsStaff(tx, {
        tenantId,
        sesionMesaId,
        items: itemsValidos,
        notas: notas?.trim() || null,
      });

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

    // Avisar al comensal (ticket) y al panel (cocina / campana).
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.channel(`mesa_${sesionMesaId}`).send({
        type: 'broadcast',
        event: 'ticket_actualizado',
        payload: { sesionMesaId },
      });
      await supabase.channel(`admin_restaurant_${session.restauranteId}`).send({
        type: 'broadcast',
        event: 'nuevo_pedido',
        payload: { sesionMesaId, pedidoId: resultado.pedidoId },
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
