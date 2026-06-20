'use server';

import { db } from '@/shared/db';
import { transaccionesPago, sesionesMesa, mesas } from '@/shared/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export type TransaccionCobro = {
    id: string;
    monto: string;
    descuento: string;
    proveedor: string;
    estado: string;
    fecha: Date;
    sesionMesaId: string;
    mesaIdentificador: string;
};

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

export async function aprobarPagoPresencialAction(transactionId: string, tenantId: string) {
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

        // 1. Marcar como aprobado
        await db.update(transaccionesPago)
            .set({ estado: 'Aprobado' })
            .where(eq(transaccionesPago.id, transactionId));

        // 2. Cerrar la sesión de la mesa
        await db.update(sesionesMesa)
            .set({ estado: 'Cerrada' })
            .where(eq(sesionesMesa.id, tx.sesionMesaId));

        return { success: true, message: 'Pago aprobado y mesa cerrada.' };
    } catch (error: any) {
        console.error('[aprobarPagoPresencialAction]', error);
        return { success: false, message: error.message || 'Error al aprobar el pago.' };
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
    } catch (error: any) {
        console.error('[rechazarPagoPresencialAction]', error);
        return { success: false, message: error.message || 'Error al rechazar el pago.' };
    }
}
