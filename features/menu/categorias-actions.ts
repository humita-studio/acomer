'use server';

import { db } from '@/shared/db';
import { categorias } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';

export async function crearCategoria(nombre: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tienes permiso para gestionar el menú' };
    }

    await db.insert(categorias).values({
      restauranteId: session.restauranteId,
      nombre,
    });

    revalidatePath('/admin/menu');
    return { success: true, message: 'Categoría creada exitosamente' };
  } catch (error) {
    console.error('[crearCategoria]', error);
    return { success: false, message: 'Error al crear la categoría' };
  }
}

export async function editarCategoria(id: string, nombre: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tienes permiso para gestionar el menú' };
    }

    await db
      .update(categorias)
      .set({ nombre })
      .where(
        and(
          eq(categorias.id, id),
          eq(categorias.restauranteId, session.restauranteId)
        )
      );

    revalidatePath('/admin/menu');
    return { success: true, message: 'Categoría actualizada' };
  } catch (error) {
    console.error('[editarCategoria]', error);
    return { success: false, message: 'Error al actualizar la categoría' };
  }
}

export async function eliminarCategoria(id: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tienes permiso para gestionar el menú' };
    }

    // Soft delete
    await db
      .update(categorias)
      .set({ deletedAt: new Date(), activo: false })
      .where(
        and(
          eq(categorias.id, id),
          eq(categorias.restauranteId, session.restauranteId)
        )
      );

    revalidatePath('/admin/menu');
    return { success: true, message: 'Categoría eliminada' };
  } catch (error) {
    console.error('[eliminarCategoria]', error);
    return { success: false, message: 'Error al eliminar la categoría' };
  }
}
