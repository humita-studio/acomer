'use server';

import { transaccionesPago, sesionesMesa } from '@/shared/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import {
  getSesionCajaAbiertaId,
  requireSesionCajaAbierta,
} from '@/features/caja/sesionCaja';
import type { TransaccionCobro } from './types';

// El restaurante se deriva siempre de la sesión (nunca del cliente) y todo el
// trabajo de base corre bajo `withTenant` (RLS activo), de modo que la propia
// base impide leer o tocar filas de otro restaurante aunque la capa de
// aplicación tuviera un bug.
export async function getTransaccionesPendientesAction(): Promise<TransaccionCobro[]> {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canProcessPayments')) return [];
    const tenantId = session.restauranteId;
    try {
        return await withTenant(claimsFromSession(session), async (db) => {
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
                metadata: tx.metadata as Record<string, unknown> | null,
                resueltaAt: tx.updatedAt,
            }));
        });
    } catch (error) {
        console.error('[getTransaccionesPendientesAction]', error);
        return [];
    }
}

/** Devuelve las transacciones del día agrupables por estado (Pendiente, Aprobado, Rechazado). */
export async function getTransaccionesTableroAction(): Promise<TransaccionCobro[]> {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canProcessPayments')) return [];
    const tenantId = session.restauranteId;
    try {
        return await withTenant(claimsFromSession(session), async (db) => {
            const txs = await db.query.transaccionesPago.findMany({
                where: and(
                    eq(transaccionesPago.restauranteId, tenantId),
                    inArray(transaccionesPago.estado, ['Pendiente', 'Aprobado', 'Rechazado'])
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
                metadata: tx.metadata as Record<string, unknown> | null,
                resueltaAt: tx.updatedAt,
            }));
        });
    } catch (error) {
        console.error('[getTransaccionesTableroAction]', error);
        return [];
    }
}


type AprobarOpts = {
    /** Efectivo recibido, para registrar el vuelto entregado. */
    montoRecibido?: number;
};

export async function aprobarPagoPresencialAction(
    transactionId: string,
    opts: AprobarOpts = {}
) {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canProcessPayments')) {
        return { success: false, message: 'No autorizado' };
    }
    const tenantId = session.restauranteId;
    try {
        return await withTenant(claimsFromSession(session), async (db) => {
            const tx = await db.query.transaccionesPago.findFirst({
                where: and(
                    eq(transaccionesPago.id, transactionId),
                    eq(transaccionesPago.restauranteId, tenantId)
                )
            });

            if (!tx || tx.estado !== 'Pendiente') {
                return { success: false, message: 'La transacción no es válida o ya fue procesada.' };
            }

            // Efectivo: la caja debe estar abierta (el dinero físico entra al turno).
            // Tarjeta u otros: se asocian a la caja si hay una abierta, sin bloquear.
            let sesionCajaId: string | null = null;
            if (tx.proveedor === 'efectivo') {
                const caja = await requireSesionCajaAbierta(tenantId, db);
                if (!caja.ok) return { success: false, message: caja.message };
                sesionCajaId = caja.sesionCajaId;
            } else {
                sesionCajaId = await getSesionCajaAbiertaId(tenantId, db);
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
                    // Al aprobar fijamos el turno actual (cuando se cobra de verdad).
                    sesionCajaId: sesionCajaId ?? tx.sesionCajaId,
                    updatedAt: new Date(),
                })
                .where(eq(transaccionesPago.id, transactionId));

            // 2. Cerrar la sesión de la mesa
            await db.update(sesionesMesa)
                .set({ estado: 'Cerrada' })
                .where(eq(sesionesMesa.id, tx.sesionMesaId));

            return { success: true, message: 'Pago aprobado y mesa cerrada.' };
        });
    } catch (error) {
        console.error('[aprobarPagoPresencialAction]', error);
        return { success: false, message: error instanceof Error ? error.message : 'Error al aprobar el pago.' };
    }
}

export async function rechazarPagoPresencialAction(transactionId: string) {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canProcessPayments')) {
        return { success: false, message: 'No autorizado' };
    }
    const tenantId = session.restauranteId;
    try {
        return await withTenant(claimsFromSession(session), async (db) => {
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
        });
    } catch (error) {
        console.error('[rechazarPagoPresencialAction]', error);
        return { success: false, message: error instanceof Error ? error.message : 'Error al rechazar el pago.' };
    }
}
