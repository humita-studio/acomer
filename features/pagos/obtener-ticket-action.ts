'use server';

import { db } from '@/shared/db';
import { eq, and, ne } from 'drizzle-orm';
import {
    transaccionesPago,
    pedidos,
    comandaItems,
    sesionesMesa
} from '@/shared/db/schema';

export type TicketItem = {
    id: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    modificadores: { nombre: string; precioExtra: number }[];
    subtotal: number;
};

export type TicketData = {
    transaccion: {
        id: string;
        monto: number;
        proveedor: string;
        estado: string;
        fecha: Date;
    };
    sesionMesaId: string;
    // salon | takeaway | delivery — para decidir si mostrar seguimiento de entrega.
    tipo: string;
    mesaIdentificador: string;
    items: TicketItem[];
    totalPagado?: number;
    saldoPendiente?: number;
};

export async function obtenerTicketAction(transactionId: string): Promise<{ success: boolean; data?: TicketData; message?: string }> {
    try {
        // 1. Obtener la transacción
        const tx = await db.query.transaccionesPago.findFirst({
            where: eq(transaccionesPago.id, transactionId),
            with: {
                sesionMesa: true
            }
        });

        if (!tx) {
            return { success: false, message: 'Transacción no encontrada.' };
        }

        // 2. Obtener todos los pedidos asociados a esa sesión (excepto cancelados)
        const pedidosMesa = await db.query.pedidos.findMany({
            where: and(
                eq(pedidos.sesionMesaId, tx.sesionMesaId),
                ne(pedidos.estado, 'Cancelado')
            ),
            with: {
                items: {
                    with: {
                        modificadores: true
                    }
                }
            }
        });

        // 3. Procesar los items para el ticket
        const ticketItemsMap = new Map<string, TicketItem>();

        for (const pedido of pedidosMesa) {
            for (const item of pedido.items) {
                // Agrupar items idénticos (mismo producto y mismos modificadores) para simplificar el ticket
                const modKey = JSON.stringify(item.modificadores || []);
                const key = `${item.productoId}-${modKey}`;

                const existing = ticketItemsMap.get(key);

                const precioTotalMods = item.modificadores.reduce(
                    (acc, mod) => acc + (Number(mod.precioExtraSnapshot) || 0),
                    0,
                );
                const precioUnitarioBase = Number(item.precioUnitarioSnapshot) || 0;
                const precioItemConMods = precioUnitarioBase + precioTotalMods;

                const itemCantidad = Number(item.cantidad);

                if (existing) {
                    existing.cantidad += itemCantidad;
                    existing.subtotal += (itemCantidad * precioItemConMods);
                } else {
                    ticketItemsMap.set(key, {
                        id: item.id,
                        nombre: item.nombreProductoSnapshot || 'Producto sin nombre',
                        cantidad: itemCantidad,
                        precioUnitario: precioUnitarioBase,
                        modificadores: item.modificadores.map((m) => ({
                            nombre: m.nombreModificadorSnapshot,
                            precioExtra: Number(m.precioExtraSnapshot) || 0,
                        })),
                        subtotal: itemCantidad * precioItemConMods
                    });
                }
            }
        }

        const items = Array.from(ticketItemsMap.values());
        const totalPedidos = items.reduce((acc, item) => acc + item.subtotal, 0);

        // Fetch approved payments
        const pagosAprobados = await db.query.transaccionesPago.findMany({
            where: and(
                eq(transaccionesPago.sesionMesaId, tx.sesionMesaId),
                eq(transaccionesPago.estado, 'Aprobado')
            )
        });
        const totalPagado = pagosAprobados.reduce((acc, t) => acc + Number(t.monto), 0);
        const saldoPendiente = Math.max(0, totalPedidos - totalPagado);

        return {
            success: true,
            data: {
                transaccion: {
                    id: tx.id,
                    monto: Number(tx.monto),
                    proveedor: tx.proveedor,
                    estado: tx.estado,
                    fecha: tx.createdAt,
                },
                sesionMesaId: tx.sesionMesaId,
                tipo: tx.sesionMesa?.tipo ?? 'salon',
                mesaIdentificador: tx.sesionMesa?.mesaId || 'Mesa',
                items,
                totalPagado,
                saldoPendiente
            }
        };

    } catch (error) {
        console.error('[obtenerTicketAction]', error);
        return { success: false, message: 'Error interno al obtener el ticket.' };
    }
}
