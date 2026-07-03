'use server';

import { categorias } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath, revalidateTag } from 'next/cache';

// El `db` de cada acción es el handle transaccional de withTenant: corre con RLS
// activo, de modo que la base sólo deja ver/tocar filas del tenant en sesión.

/**
 * Lista las categorías del menú del restaurante. Estado de servidor que consume
 * TanStack Query en el admin (siembra `initialData`).
 */
export async function obtenerCategoriasMenu() {
  const session = await getCurrentSession();
  if (!session) return [];
  return withTenant(claimsFromSession(session), (db) =>
    db
      .select({ id: categorias.id, nombre: categorias.nombre })
      .from(categorias)
      .where(and(eq(categorias.restauranteId, session.restauranteId), isNull(categorias.deletedAt)))
      .orderBy(categorias.createdAt)
  );
}

export async function crearCategoria(nombre: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tienes permiso para gestionar el menú' };
    }

    await withTenant(claimsFromSession(session), (db) =>
      db.insert(categorias).values({
        restauranteId: session.restauranteId,
        nombre,
      })
    );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
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

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(categorias)
        .set({ nombre })
        .where(
          and(
            eq(categorias.id, id),
            eq(categorias.restauranteId, session.restauranteId)
          )
        )
    );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
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
    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(categorias)
        .set({ deletedAt: new Date(), activo: false })
        .where(
          and(
            eq(categorias.id, id),
            eq(categorias.restauranteId, session.restauranteId)
          )
        )
    );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Categoría eliminada' };
  } catch (error) {
    console.error('[eliminarCategoria]', error);
    return { success: false, message: 'Error al eliminar la categoría' };
  }
}
