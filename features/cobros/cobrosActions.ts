'use server';

import { db } from '@/shared/db';
import { transaccionesPago, sesionesMesa } from '@/shared/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import type { TransaccionCobro } from './types';

export async function getTransaccionesPendientesAction(tenantId: string): Promise<TransaccionCobro[]> {
    try {
        const txs = await db.query.transaccionesPago.findMany({
            where: and(
                eq(transaccionesPago.restauranteId, tenantId),
                inArray(transaccionesPago.estado, ['Pendiente'])
            ),
            with: {
                sesionMesa: true,

            },
            orderBy: [desc(transaccionesPago.createdAt)],
        });

        return txs.map(tx => ({
            id: tx.id,
            monto: tx.monto,
            descuento: tx.descuento ?? '0',
            proveedor: tx.proveedor,
            estado: tx.estado,
            fecha: tx.createdAt,
            sesionMesaId: tx.sesionMesaId,
            mesaIdentificador: tx.sesionMesa?.mesaId || 'Desconocida',
        }));
    } catch (error) {
        console.error('[getTransaccionesPendientesAction]', error);
        return [];
    }
}

type AprobarOpts = {
    /** Efectivo recibido, para registrar el vuelto entregado. */
    montoRecibido?: number;
};

export async function aprobarPagoPresencialAction(
    transactionId: string,
    tenantId: string,
    opts: AprobarOpts = {}
) {
    try {
        const tx = await db.query.transaccionesPago.findFirst({
            where: and(
                eq(transaccionesPago.id, transactionId),
                eq(transaccionesPago.restauranteId, tenantId)
            )
        });

        if (!tx || tx.estado !== 'Pendiente') {
            return { success: false, message: 'La transacción no es válida o ya fue procesada.' };
        }

        // 1. Marcar como aprobado, registrando el vuelto si se ingresó el
        // efectivo recibido. El método (proveedor) no cambia: lo eligió el
        // cliente al pedir la cuenta y el total ya viene con ese descuento.
        const metaPrev = (tx.metadata as Record<string, unknown> | null) ?? {};
        const metadata: Record<string, unknown> = { ...metaPrev };
        if (opts.montoRecibido != null) {
            metadata.montoRecibido = opts.montoRecibido;
            metadata.vuelto = Math.max(0, opts.montoRecibido - Number(tx.monto));
        }

        await db.update(transaccionesPago)
            .set({
                estado: 'Aprobado',
                metadata,
                updatedAt: new Date(),
            })
            .where(eq(transaccionesPago.id, transactionId));

        // 2. Cerrar la sesión de la mesa
        await db.update(sesionesMesa)
            .set({ estado: 'Cerrada' })
            .where(eq(sesionesMesa.id, tx.sesionMesaId));

        return { success: true, message: 'Pago aprobado y mesa cerrada.' };
    } catch (error) {
        console.error('[aprobarPagoPresencialAction]', error);
        return { success: false, message: error instanceof Error ? error.message : 'Error al aprobar el pago.' };
    }
}

export async function rechazarPagoPresencialAction(transactionId: string, tenantId: string) {
    try {
        const tx = await db.query.transaccionesPago.findFirst({
            where: and(
                eq(transaccionesPago.id, transactionId),
                eq(transaccionesPago.restauranteId, tenantId)
            )
        });

        if (!tx || tx.estado !== 'Pendiente') {
            return { success: false, message: 'La transacción no es válida o ya fue procesada.' };
        }

        // 1. Marcar como rechazado o cancelado
        await db.update(transaccionesPago)
            .set({ estado: 'Rechazado' }) // O podríamos borrarla, pero mejor dejar registro
            .where(eq(transaccionesPago.id, transactionId));

        return { success: true, message: 'Pago rechazado. La mesa sigue abierta.' };
    } catch (error) {
        console.error('[rechazarPagoPresencialAction]', error);
        return { success: false, message: error instanceof Error ? error.message : 'Error al rechazar el pago.' };
    }
}
