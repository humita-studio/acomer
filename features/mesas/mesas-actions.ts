'use server';

import { db } from '@/shared/db';
import { mesas } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';

export async function crearMesa(identificador: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tienes permiso para gestionar mesas' };
    }

    await db.insert(mesas).values({
      restauranteId: session.restauranteId,
      identificador,
    });

    revalidatePath('/admin/mesas');
    return { success: true, message: 'Mesa creada exitosamente' };
  } catch (error) {
    console.error('[crearMesa]', error);
    return { success: false, message: 'Error al crear la mesa' };
  }
}

export async function eliminarMesa(id: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tienes permiso para gestionar mesas' };
    }

    // Soft delete
    await db
      .update(mesas)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(mesas.id, id),
          eq(mesas.restauranteId, session.restauranteId)
        )
      );

    revalidatePath('/admin/mesas');
    return { success: true, message: 'Mesa eliminada' };
  } catch (error) {
    console.error('[eliminarMesa]', error);
    return { success: false, message: 'Error al eliminar la mesa' };
  }
}

export async function liberarMesaAction(mesaId: string) {
  try {
    const session = await getCurrentSession();
    // La libera quien gestiona mesas (owner/admin) o quien toma pedidos (mozo)
    if (!session || (!hasPermission(session.role, 'canManageTables') && !hasPermission(session.role, 'canTakeOrders'))) {
      return { success: false, message: 'No tienes permiso para liberar la mesa' };
    }

    const { sesionesMesa } = await import('@/shared/db/schema');
    
    // Cerramos cualquier sesión activa de esta mesa
    await db
      .update(sesionesMesa)
      .set({ estado: 'Cerrada' })
      .where(
        and(
          eq(sesionesMesa.mesaId, mesaId),
          eq(sesionesMesa.restauranteId, session.restauranteId),
          eq(sesionesMesa.estado, 'Activa')
        )
      );

    revalidatePath('/admin/mesas');
    return { success: true, message: 'Mesa liberada correctamente' };
  } catch (error) {
    console.error('[liberarMesaAction]', error);
    return { success: false, message: 'Error al liberar la mesa' };
  }
}
