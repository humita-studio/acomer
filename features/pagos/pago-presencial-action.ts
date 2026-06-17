'use server';

import { db } from '@/shared/db';
import { transaccionesPago, pedidos, sesionesMesa } from '@/shared/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/shared/supabase/server';

type PagoPresencialResult = {
  success: boolean;
  message: string;
  transactionId?: string;
};

/**
 * Crea una transacción para pagos presenciales (efectivo, tarjeta física).
 * No redirige a ningún checkout — solo registra la intención de pago
 * y notifica al staff del restaurante.
 */
export async function pedirCuentaPresencialAction(
  sesionMesaId: string,
  tenantId: string,
  metodoPago: 'efectivo' | 'tarjeta_fisica'
): Promise<PagoPresencialResult> {
  try {
    // 1. Validar la sesión
    const sesion = await db.query.sesionesMesa.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, sesionMesaId), eq(t.restauranteId, tenantId)),
    });

    if (!sesion || sesion.estado !== 'Activa') {
      return { success: false, message: 'La sesión no es válida o ya está cerrada.' };
    }

    // 2. Calcular el total
    const pedidosMesa = await db.query.pedidos.findMany({
      where: (t, { eq, and, ne }) => and(
        eq(t.sesionMesaId, sesionMesaId),
        ne(t.estado, 'Cancelado')
      ),
    });

    if (pedidosMesa.length === 0) {
      return { success: false, message: 'No hay pedidos para cobrar.' };
    }

    const totalPedidos = pedidosMesa.reduce((acc, p) => acc + Number(p.total), 0);

    const pagosAprobados = await db.query.transaccionesPago.findMany({
      where: (t, { eq, and }) => and(
        eq(t.sesionMesaId, sesionMesaId),
        eq(t.estado, 'Aprobado')
      )
    });
    const totalPagado = pagosAprobados.reduce((acc, tx) => acc + Number(tx.monto), 0);
    const saldoPendiente = totalPedidos - totalPagado;

    if (saldoPendiente <= 0) {
      return { success: false, message: 'La mesa ya se encuentra pagada.' };
    }

    const totalCalculado = saldoPendiente;

    // 3. Revisar si ya existe una transacción pendiente
    const existingTx = await db.query.transaccionesPago.findFirst({
      where: (t, { eq, and }) => and(
        eq(t.sesionMesaId, sesionMesaId),
        eq(t.estado, 'Pendiente')
      )
    });

    let transactionId;
    
    if (existingTx) {
      transactionId = existingTx.id;
      // Actualizamos el método por si eligió uno distinto esta vez
      if (existingTx.proveedor !== metodoPago) {
        await db.update(transaccionesPago)
          .set({ proveedor: metodoPago, metadata: { metodo: metodoPago } })
          .where(eq(transaccionesPago.id, existingTx.id));
      }
    } else {
      // Crear transacción en DB
      const nuevaTx = await db.insert(transaccionesPago).values({
        restauranteId: tenantId,
        sesionMesaId: sesionMesaId,
        proveedor: metodoPago,
        monto: totalCalculado.toString(),
        estado: 'Pendiente',
        metadata: { metodo: metodoPago },
      }).returning({ id: transaccionesPago.id });

      transactionId = nuevaTx[0].id;
    }

    // 4. Notificar al staff vía Supabase Realtime
    try {
      const supabase = await createSupabaseServerClient();
      const channel = supabase.channel(`admin_restaurant_${tenantId}`);
      await channel.send({
        type: 'broadcast',
        event: 'cuenta_solicitada',
        payload: {
          sesionMesaId,
          transactionId,
          metodoPago,
          monto: totalCalculado,
        },
      });
    } catch (realtimeError) {
      console.warn('[pedirCuentaPresencialAction] Error enviando notificación realtime:', realtimeError);
      // No falla la operación si realtime falla
    }

    const metodoLabel = metodoPago === 'efectivo' ? 'efectivo' : 'tarjeta';
    const totalFmt = totalCalculado.toFixed(2);

    // El mensaje depende de dónde se cobra: en salón se acerca un mozo; en
    // takeaway/delivery se paga al retirar/recibir (no hay mesa).
    let message: string;
    if (sesion.tipo === 'delivery') {
      message = `¡Pedido confirmado! Pagás $${totalFmt} en ${metodoLabel} al recibir tu pedido.`;
    } else if (sesion.tipo === 'takeaway') {
      message = `¡Pedido confirmado! Pagás $${totalFmt} en ${metodoLabel} al retirarlo en el local.`;
    } else {
      message = `Cuenta solicitada. Un mozo se acercará para cobrar con ${metodoLabel}. Total: $${totalFmt}`;
    }

    return {
      success: true,
      message,
      transactionId,
    };
  } catch (error: any) {
    console.error('[pedirCuentaPresencialAction]', error);
    return { success: false, message: error.message || 'Error interno del servidor' };
  }
}
