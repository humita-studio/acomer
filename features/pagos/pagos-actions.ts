'use server';

import { transaccionesPago } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getPaymentProvider } from './core/payment-factory';
import { calcularCobroConPromos } from '@/features/promociones/cobroPromosActions';
import type { PromoCanal } from '@/features/promociones/promociones';
import { getSesionCajaAbiertaId } from '@/features/caja/sesionCaja';
import { pedirCuentaSchema } from './validation';
import { withPublicTenant } from '@/shared/db/secure-wrapper';

export async function pedirCuentaAction(
  sesionMesaId: string,
  tenantId: string,
  currentUrl: string,
) {
  try {
    const parsed = pedirCuentaSchema.safeParse({ sesionMesaId, tenantId, currentUrl });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    // 1. Sesión + pedidos + pagos ya aprobados bajo RLS público del tenant.
    const { sesion, pedidosMesa, pagosAprobados } = await withPublicTenant(
      tenantId,
      async (tx) => {
        const sesion = await tx.query.sesionesMesa.findFirst({
          where: (t, { eq, and }) =>
            and(eq(t.id, sesionMesaId), eq(t.restauranteId, tenantId)),
          with: { restaurante: true },
        });
        const pedidosMesa = await tx.query.pedidos.findMany({
          where: (t, { eq, and, ne }) =>
            and(eq(t.sesionMesaId, sesionMesaId), ne(t.estado, 'Cancelado')),
        });
        const pagosAprobados = await tx.query.transaccionesPago.findMany({
          where: (t, { eq, and }) =>
            and(eq(t.sesionMesaId, sesionMesaId), eq(t.estado, 'Aprobado')),
        });
        return { sesion, pedidosMesa, pagosAprobados };
      },
    );

    if (!sesion || sesion.estado !== 'Activa') {
      return { success: false, message: 'La sesión no es válida o ya está cerrada.' };
    }

    if (pedidosMesa.length === 0) {
      return { success: false, message: 'No hay pedidos para cobrar.' };
    }

    const totalPedidos = pedidosMesa.reduce((acc, p) => acc + Number(p.total), 0);
    const totalPagado = pagosAprobados.reduce((acc, tx) => acc + Number(tx.monto), 0);
    const saldoPendiente = totalPedidos - totalPagado;

    if (saldoPendiente <= 0) {
      return { success: false, message: 'La mesa ya se encuentra pagada.' };
    }

    // Promos automáticas (pago con Mercado Pago).
    let descuento = 0;
    let promocionId: string | null = null;
    let promocionesAplicadas: { id: string; nombre: string; tipo: string; descuento: number }[] =
      [];
    try {
      const canal: PromoCanal =
        sesion.tipo === 'delivery'
          ? 'delivery'
          : sesion.tipo === 'takeaway'
            ? 'takeaway'
            : 'salon';
      const promoRes = await calcularCobroConPromos(sesionMesaId, tenantId, {
        metodoPago: 'mercado_pago',
        canal,
      });
      descuento = Math.min(promoRes.descuento, saldoPendiente);
      promocionId = promoRes.aplicadas.length === 1 ? promoRes.aplicadas[0].id : null;
      promocionesAplicadas = promoRes.aplicadas;
    } catch (promoError) {
      console.warn('[pedirCuentaAction] promos no aplicadas:', promoError);
    }
    const totalCalculado = Math.max(0, saldoPendiente - descuento);

    // 3. Crear registro de transacción pendiente (asociada a la caja abierta si hay).
    const transactionId = await withPublicTenant(tenantId, async (tx) => {
      const sesionCajaId = await getSesionCajaAbiertaId(tenantId, tx);
      const nuevaTx = await tx
        .insert(transaccionesPago)
        .values({
          restauranteId: tenantId,
          sesionMesaId,
          sesionCajaId,
          proveedor: 'indefinido_por_ahora',
          monto: totalCalculado.toString(),
          descuento: descuento.toString(),
          promocionId,
          promocionesAplicadas,
          estado: 'Pendiente',
        })
        .returning({ id: transaccionesPago.id });
      return nuevaTx[0].id;
    });

    // 4. Provider
    const provider = await getPaymentProvider(tenantId);
    const providerName =
      provider.constructor.name === 'MercadoPagoProvider' ? 'mercado_pago' : 'mock';

    await withPublicTenant(tenantId, (tx) =>
      tx
        .update(transaccionesPago)
        .set({ proveedor: providerName })
        .where(eq(transaccionesPago.id, transactionId)),
    );

    // 5. Payment intent
    const baseUrl = currentUrl.split('?')[0];

    const intentResult = await provider.createPaymentIntent(totalCalculado, transactionId, {
      restaurantName: sesion.restaurante.nombre,
      items: [],
      successUrl: `${baseUrl}?pago=exito&tx=${transactionId}`,
      failureUrl: `${baseUrl}?pago=error&tx=${transactionId}`,
      pendingUrl: `${baseUrl}?pago=pendiente&tx=${transactionId}`,
    });

    if (!intentResult.success || !intentResult.paymentUrl) {
      return {
        success: false,
        message: intentResult.error || 'Error al generar el link de pago',
      };
    }

    if (intentResult.externalReference) {
      await withPublicTenant(tenantId, (tx) =>
        tx
          .update(transaccionesPago)
          .set({ referenciaExterna: intentResult.externalReference })
          .where(eq(transaccionesPago.id, transactionId)),
      );
    }

    return {
      success: true,
      paymentUrl: intentResult.paymentUrl,
    };
  } catch (error) {
    console.error('[pedirCuentaAction]', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}
