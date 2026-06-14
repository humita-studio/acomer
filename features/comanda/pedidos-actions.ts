'use server';

import { db } from '@/shared/db';
import { pedidos } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';

export async function cambiarEstadoPedido(pedidoId: string, nuevoEstado: 'Pendiente' | 'En Preparación' | 'Listo' | 'Entregado') {
  try {
    const session = await getCurrentSession();
    
    // Cocina puede cambiar a En Preparación y Listo.
    // Mozo puede cambiar a Entregado.
    if (!session || (!hasPermission(session.role, 'canAcceptOrders') && !hasPermission(session.role, 'canMarkDelivered'))) {
      return { success: false, message: 'No autorizado' };
    }

    await db
      .update(pedidos)
      .set({ estado: nuevoEstado, updatedAt: new Date() })
      .where(
        and(
          eq(pedidos.id, pedidoId),
          eq(pedidos.restauranteId, session.restauranteId)
        )
      );

    return { success: true, message: 'Estado actualizado' };
  } catch (error) {
    console.error('[cambiarEstadoPedido]', error);
    return { success: false, message: 'Error al cambiar estado' };
  }
}
