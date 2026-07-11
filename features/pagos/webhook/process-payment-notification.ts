import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/shared/db';
import { pedidos, sesionesMesa, transaccionesPago } from '@/shared/db/schema';
import { getPaymentProvider } from '@/features/pagos/core/payment-factory';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import {
  decideSettlement,
  isAlreadyProcessed,
  mergePaymentMetadata,
} from './settlement-core';

export type ProcessPaymentResult =
  | { ok: true; status: string; alreadyProcessed?: boolean; settlement?: string }
  | { ok: false; httpStatus: number; error: string };

/**
 * Procesa una notificación de pago del proveedor:
 * 1. Verifica el pago en el proveedor (con token del tenant)
 * 2. Actualiza la transacción y, si corresponde, pedidos/sesión — todo en UNA tx SQL
 * 3. Emite eventos Realtime (fuera de la tx; best-effort)
 *
 * Idempotente: si la misma tx ya tiene el mismo providerPaymentId y estado, no-op.
 */
export async function processPaymentNotification(opts: {
  provider: string;
  tenantId: string;
  paymentId: string;
}): Promise<ProcessPaymentResult> {
  const { tenantId, paymentId } = opts;

  if (opts.provider !== 'mercado_pago' && opts.provider !== 'mock') {
    return { ok: false, httpStatus: 400, error: `Unsupported provider: ${opts.provider}` };
  }

  let paymentProvider;
  try {
    paymentProvider = await getPaymentProvider(tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider error';
    return { ok: false, httpStatus: 400, error: message };
  }

  const verification = await paymentProvider.verifyPayment(paymentId);
  const transactionId = verification.referenciaExterna;

  if (!transactionId) {
    return { ok: false, httpStatus: 400, error: 'Payment does not have external_reference' };
  }

  // --- Transacción atómica de liquidación ---
  type Inner = {
    result: ProcessPaymentResult;
    notify?: {
      kind: 'full' | 'partial';
      sesionMesaId: string;
      totalPedidos?: number;
      totalPagado?: number;
    };
  };

  const { result, notify } = await db.transaction(async (tx): Promise<Inner> => {
    const [row] = await tx
      .select()
      .from(transaccionesPago)
      .where(eq(transaccionesPago.id, transactionId))
      .limit(1);

    if (!row) {
      return {
        result: { ok: false, httpStatus: 404, error: 'Transaction not found in DB' },
      };
    }

    // Multi-tenant: la tx debe pertenecer al tenant del webhook.
    if (row.restauranteId !== tenantId) {
      return {
        result: { ok: false, httpStatus: 403, error: 'Transaction tenant mismatch' },
      };
    }

    if (
      isAlreadyProcessed(row.estado, row.metadata, paymentId, verification.status)
    ) {
      return {
        result: {
          ok: true,
          status: verification.status,
          alreadyProcessed: true,
          settlement: 'noop',
        },
      };
    }

    const metadata = mergePaymentMetadata(row.metadata, paymentId, verification.metadata);

    const [sesion] = await tx
      .select({ id: sesionesMesa.id, tipo: sesionesMesa.tipo })
      .from(sesionesMesa)
      .where(eq(sesionesMesa.id, row.sesionMesaId))
      .limit(1);

    const pedidosSesion = await tx
      .select({
        id: pedidos.id,
        estado: pedidos.estado,
        total: pedidos.total,
      })
      .from(pedidos)
      .where(eq(pedidos.sesionMesaId, row.sesionMesaId));

    const txsSesion = await tx
      .select({
        id: transaccionesPago.id,
        estado: transaccionesPago.estado,
        monto: transaccionesPago.monto,
      })
      .from(transaccionesPago)
      .where(eq(transaccionesPago.sesionMesaId, row.sesionMesaId));

    const decision = decideSettlement({
      currentTxId: row.id,
      newStatus: verification.status,
      pedidos: pedidosSesion,
      transacciones: txsSesion,
      tipoSesion: sesion?.tipo,
      alreadyFinal: false,
    });

    // Actualizar la transacción siempre (estado + metadata con payment id).
    await tx
      .update(transaccionesPago)
      .set({
        estado: verification.status,
        metadata,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transaccionesPago.id, row.id),
          eq(transaccionesPago.restauranteId, tenantId),
        ),
      );

    if (decision.kind === 'status_only' || decision.kind === 'noop') {
      return {
        result: {
          ok: true,
          status: verification.status,
          settlement: decision.kind,
        },
      };
    }

    if (decision.kind === 'partial') {
      return {
        result: {
          ok: true,
          status: verification.status,
          settlement: 'partial',
        },
        notify: {
          kind: 'partial',
          sesionMesaId: row.sesionMesaId,
          totalPedidos: decision.totalPedidos,
          totalPagado: decision.totalPagado,
        },
      };
    }

    // full
    if (decision.pedidoIdsAMarcarPagado.length > 0) {
      for (const pedidoId of decision.pedidoIdsAMarcarPagado) {
        await tx
          .update(pedidos)
          .set({ estado: 'Pagado', updatedAt: new Date() })
          .where(
            and(
              eq(pedidos.id, pedidoId),
              eq(pedidos.restauranteId, tenantId),
              ne(pedidos.estado, 'Cancelado'),
            ),
          );
      }
    }

    if (decision.cerrarSesion) {
      await tx
        .update(sesionesMesa)
        .set({ estado: 'Cerrada', updatedAt: new Date() })
        .where(
          and(
            eq(sesionesMesa.id, row.sesionMesaId),
            eq(sesionesMesa.restauranteId, tenantId),
          ),
        );
    }

    return {
      result: {
        ok: true,
        status: verification.status,
        settlement: 'full',
      },
      notify: {
        kind: 'full',
        sesionMesaId: row.sesionMesaId,
        totalPedidos: decision.totalPedidos,
        totalPagado: decision.totalPagado,
      },
    };
  });

  // Realtime best-effort (fuera de la tx DB).
  if (notify) {
    try {
      const supabase = await createSupabaseServerClient();
      const adminChannel = supabase.channel(`admin_restaurant_${tenantId}`);

      if (notify.kind === 'full') {
        const mesaChannel = supabase.channel(`mesa_${notify.sesionMesaId}`);
        await mesaChannel.send({
          type: 'broadcast',
          event: 'pago_completado',
          payload: { transactionId },
        });
        await adminChannel.send({
          type: 'broadcast',
          event: 'mesa_pagada',
          payload: { sesionMesaId: notify.sesionMesaId },
        });
      } else {
        await adminChannel.send({
          type: 'broadcast',
          event: 'pago_parcial',
          payload: {
            sesionMesaId: notify.sesionMesaId,
            pagado: notify.totalPagado,
            total: notify.totalPedidos,
          },
        });
      }
    } catch (err) {
      console.error('[processPaymentNotification] realtime notify failed', err);
    }
  }

  return result;
}
