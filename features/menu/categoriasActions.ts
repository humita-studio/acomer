'use server';

import { db } from '@/shared/db';
import { categorias } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';

/**
 * Lista las categorías del menú del restaurante. Estado de servidor que consume
 * TanStack Query en el admin (siembra `initialData`).
 */
export async function obtenerCategoriasMenu() {
  const session = await getCurrentSession();
  if (!session) return [];
  return db
    .select({ id: categorias.id, nombre: categorias.nombre })
    .from(categorias)
    .where(and(eq(categorias.restauranteId, session.restauranteId), isNull(categorias.deletedAt)))
    .orderBy(categorias.createdAt);
}

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

    return { success: true, message: 'Categoría eliminada' };
  } catch (error) {
    console.error('[eliminarCategoria]', error);
    return { success: false, message: 'Error al eliminar la categoría' };
  }
}
