'use server';

import { db } from '@/shared/db';
import { pedidos, transaccionesPago, sesionesMesa, restaurantes } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPaymentProvider } from './core/payment-factory';
import { calcularCobroConPromos } from '@/features/promociones/cobroPromosActions';
import type { PromoCanal } from '@/features/promociones/promociones';

export async function pedirCuentaAction(sesionMesaId: string, tenantId: string, currentUrl: string) {
  try {
    // 1. Obtener la sesión y el restaurante para sacar su nombre
    const sesion = await db.query.sesionesMesa.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, sesionMesaId), eq(t.restauranteId, tenantId)),
      with: { restaurante: true }
    });

    if (!sesion || sesion.estado !== 'Activa') {
      return { success: false, message: 'La sesión no es válida o ya está cerrada.' };
    }

    // 2. Calcular el total de la mesa sumando los pedidos que no están cancelados
    const pedidosMesa = await db.query.pedidos.findMany({
      where: (t, { eq, and, ne }) => and(
        eq(t.sesionMesaId, sesionMesaId),
        ne(t.estado, 'Cancelado')
      )
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

    // Promos automáticas (pago con Mercado Pago). Si falla (p.ej. la migración de
    // promos no corrió) se cobra sin descuento.
    let descuento = 0;
    let promocionId: string | null = null;
    let promocionesAplicadas: { id: string; nombre: string; tipo: string; descuento: number }[] = [];
    try {
      const canal: PromoCanal =
        sesion.tipo === 'delivery' ? 'delivery' : sesion.tipo === 'takeaway' ? 'takeaway' : 'salon';
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

    // 3. Crear registro de transacción pendiente en DB
    const nuevaTx = await db.insert(transaccionesPago).values({
      restauranteId: tenantId,
      sesionMesaId: sesionMesaId,
      proveedor: 'indefinido_por_ahora', // Se actualizará en breve
      monto: totalCalculado.toString(),
      descuento: descuento.toString(),
      promocionId,
      promocionesAplicadas,
      estado: 'Pendiente',
    }).returning({ id: transaccionesPago.id });

    const transactionId = nuevaTx[0].id;

    // 4. Instanciar el provider
    const provider = await getPaymentProvider(tenantId);
    
    // Identificar qué proveedor es en base al constructor para guardar en DB
    // Hack simple: ver el nombre de la clase
    const providerName = provider.constructor.name === 'MercadoPagoProvider' ? 'mercado_pago' : 'mock';

    await db.update(transaccionesPago)
      .set({ proveedor: providerName })
      .where(eq(transaccionesPago.id, transactionId));

    // 5. Crear el Payment Intent
    // Use the current URL and append query parameters to it, 
    // since we want the user to return to the table view.
    const baseUrl = currentUrl.split('?')[0]; // Remove existing query params just in case
    
    const intentResult = await provider.createPaymentIntent(
      totalCalculado,
      transactionId,
      {
        restaurantName: sesion.restaurante.nombre,
        items: [], // Enviaríamos el desglose aquí, pero para simplificar enviamos el total consolidado desde el provider si items.length == 0
        successUrl: `${baseUrl}?pago=exito&tx=${transactionId}`,
        failureUrl: `${baseUrl}?pago=error&tx=${transactionId}`,
        pendingUrl: `${baseUrl}?pago=pendiente&tx=${transactionId}`,
      }
    );

    if (!intentResult.success || !intentResult.paymentUrl) {
      return { success: false, message: intentResult.error || 'Error al generar el link de pago' };
    }

    // Actualizar referencia externa en la DB
    if (intentResult.externalReference) {
      await db.update(transaccionesPago)
        .set({ referenciaExterna: intentResult.externalReference })
        .where(eq(transaccionesPago.id, transactionId));
    }

    // 6. Retornar la URL al frontend
    return { 
      success: true, 
      paymentUrl: intentResult.paymentUrl 
    };

  } catch (error) {
    console.error('[pedirCuentaAction]', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}
