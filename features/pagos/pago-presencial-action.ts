'use server';

import { db } from '@/shared/db';
import { transaccionesPago } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { calcularCobroConPromos } from '@/features/promociones/cobroPromosActions';
import type { PromoCanal } from '@/features/promociones/promociones';
import { getSesionCajaAbiertaId } from '@/features/caja/sesionCaja';
import { pedirCuentaPresencialSchema } from './validation';
import { withPublicTenant } from '@/shared/db/secure-wrapper';

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
  metodoPago: 'efectivo' | 'tarjeta_fisica',
  /** Promos que el cajero quitó manualmente (descuento removible). */
  omitirPromoIds?: string[]
): Promise<PagoPresencialResult> {
  try {
    const parsed = pedirCuentaPresencialSchema.safeParse({
      sesionMesaId,
      tenantId,
      metodoPago,
      omitirPromoIds,
    });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    // 1 + 2 en paralelo bajo RLS público del tenant.
    const [sesion, pedidosMesa] = await withPublicTenant(tenantId, (tx) =>
      Promise.all([
        tx.query.sesionesMesa.findFirst({
          where: (t, { eq, and }) => and(eq(t.id, sesionMesaId), eq(t.restauranteId, tenantId)),
        }),
        tx.query.pedidos.findMany({
          where: (t, { eq, and, ne }) =>
            and(eq(t.sesionMesaId, sesionMesaId), ne(t.estado, 'Cancelado')),
        }),
      ]),
    );

    if (!sesion || sesion.estado !== 'Activa') {
      return { success: false, message: 'La sesión no es válida o ya está cerrada.' };
    }

    if (pedidosMesa.length === 0) {
      return { success: false, message: 'No hay pedidos para cobrar.' };
    }

    const totalPedidos = pedidosMesa.reduce((acc, p) => acc + Number(p.total), 0);

    // 3: pagos ya aprobados y tx pendiente existente en paralelo.
    const [pagosAprobados, existingTx] = await Promise.all([
      db.query.transaccionesPago.findMany({
        where: (t, { eq, and }) =>
          and(eq(t.sesionMesaId, sesionMesaId), eq(t.estado, 'Aprobado')),
      }),
      db.query.transaccionesPago.findFirst({
        where: (t, { eq, and }) =>
          and(eq(t.sesionMesaId, sesionMesaId), eq(t.estado, 'Pendiente')),
      }),
    ]);

    const totalPagado = pagosAprobados.reduce((acc, tx) => acc + Number(tx.monto), 0);
    const saldoPendiente = totalPedidos - totalPagado;

    if (saldoPendiente <= 0) {
      return { success: false, message: 'La mesa ya se encuentra pagada.' };
    }

    // Promociones: corre mientras ya tenemos sesión y saldo, no necesita la tx.
    let descuento = 0;
    let promocionId: string | null = null;
    let promocionesAplicadas: { id: string; nombre: string; tipo: string; descuento: number }[] = [];
    try {
      const metodoPromo = metodoPago === 'efectivo' ? 'efectivo' : 'tarjeta';
      const canal: PromoCanal =
        sesion.tipo === 'delivery' ? 'delivery' : sesion.tipo === 'takeaway' ? 'takeaway' : 'salon';
      const promoRes = await calcularCobroConPromos(sesionMesaId, tenantId, {
        metodoPago: metodoPromo,
        canal,
        omitirIds: omitirPromoIds,
      });
      descuento = Math.min(promoRes.descuento, saldoPendiente);
      // promocion_id sólo guarda UNA promo; con varias queda null y el detalle vive
      // en promociones_aplicadas (snapshot completo).
      promocionId = promoRes.aplicadas.length === 1 ? promoRes.aplicadas[0].id : null;
      promocionesAplicadas = promoRes.aplicadas;
    } catch (promoError) {
      console.warn('[pedirCuentaPresencialAction] promos no aplicadas:', promoError);
    }
    const totalCalculado = Math.max(0, saldoPendiente - descuento);

    // Si hay caja abierta la dejamos anotada; el cobro real (aprobación staff)
    // reasigna al turno vigente y exige caja abierta para efectivo.
    const sesionCajaId = await getSesionCajaAbiertaId(tenantId);

    let transactionId;

    if (existingTx) {
      transactionId = existingTx.id;
      // Recalcular método y total (el descuento depende del método elegido).
      await db.update(transaccionesPago)
        .set({
          proveedor: metodoPago,
          monto: totalCalculado.toString(),
          descuento: descuento.toString(),
          promocionId,
          promocionesAplicadas,
          sesionCajaId: sesionCajaId ?? existingTx.sesionCajaId,
          metadata: { metodo: metodoPago },
        })
        .where(eq(transaccionesPago.id, existingTx.id));
    } else {
      // Crear transacción en DB
      const nuevaTx = await db.insert(transaccionesPago).values({
        restauranteId: tenantId,
        sesionMesaId: sesionMesaId,
        sesionCajaId,
        proveedor: metodoPago,
        monto: totalCalculado.toString(),
        descuento: descuento.toString(),
        promocionId,
        promocionesAplicadas,
        estado: 'Pendiente',
        metadata: { metodo: metodoPago },
      }).returning({ id: transaccionesPago.id });

      transactionId = nuevaTx[0].id;
    }

    // Notificar al staff vía Supabase Realtime. Fire-and-forget: el broadcast no
    // debe alargar el tiempo de respuesta del comensal; los errores se loguean.
    void (async () => {
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
      }
    })();

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
  } catch (error) {
    console.error('[pedirCuentaPresencialAction]', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}
