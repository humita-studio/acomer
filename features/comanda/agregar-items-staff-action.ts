'use server';

import { db } from '@/shared/db';
import { transaccionesPago } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
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
      const { pedidoId, totalPedido } = await crearPedidoConItemsStaff(tx, {
        tenantId,
        sesionMesaId,
        items: itemsValidos,
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
