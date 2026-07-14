'use server';

import { categorias } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath, revalidateTag } from 'next/cache';
import { normalizarVisualCategoria } from './categoriaVisual';

// El `db` de cada acción es el handle transaccional de withTenant: corre con RLS
// activo, de modo que la base sólo deja ver/tocar filas del tenant en sesión.

export type CategoriaInput = {
  nombre: string;
  color?: string;
  icono?: string;
};

/**
 * Lista las categorías del menú del restaurante. Estado de servidor que consume
 * TanStack Query en el admin (siembra `initialData`).
 */
export async function obtenerCategoriasMenu() {
  const session = await getCurrentSession();
  if (!session) return [];
  return withTenant(claimsFromSession(session), (db) =>
    db
      .select({
        id: categorias.id,
        nombre: categorias.nombre,
        color: categorias.color,
        icono: categorias.icono,
      })
      .from(categorias)
      .where(and(eq(categorias.restauranteId, session.restauranteId), isNull(categorias.deletedAt)))
      .orderBy(categorias.createdAt)
  );
}

export async function crearCategoria(input: CategoriaInput) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tenés permiso para gestionar el menú' };
    }

    const nombre = input.nombre.trim();
    if (!nombre) {
      return { success: false, message: 'El nombre es obligatorio' };
    }

    const { color, icono } = normalizarVisualCategoria(input);

    await withTenant(claimsFromSession(session), (db) =>
      db.insert(categorias).values({
        restauranteId: session.restauranteId,
        nombre,
        color,
        icono,
      })
    );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Categoría creada' };
  } catch (error) {
    console.error('[crearCategoria]', error);
    return { success: false, message: 'Error al crear la categoría' };
  }
}

export async function editarCategoria(id: string, input: CategoriaInput) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tenés permiso para gestionar el menú' };
    }

    const nombre = input.nombre.trim();
    if (!nombre) {
      return { success: false, message: 'El nombre es obligatorio' };
    }

    const { color, icono } = normalizarVisualCategoria(input);

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(categorias)
        .set({ nombre, color, icono })
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
      return { success: false, message: 'No tenés permiso para gestionar el menú' };
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

