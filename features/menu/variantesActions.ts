'use server';

import { productos, productoVariantes, productoVariantesPrecios } from '@/shared/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidateTag } from 'next/cache';
import type { Variante } from './types';

// El `db` de cada acción es el handle transaccional de withTenant: corre con RLS
// activo, de modo que la base sólo deja ver/tocar filas del tenant en sesión.

/**
 * Lista las variantes (presentaciones de elección única) del menú, con su precio
 * absoluto vigente. Estado de servidor que consume TanStack Query en el admin;
 * se agrupa por producto del lado del cliente.
 */
export async function obtenerVariantesMenu(): Promise<Variante[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  const rows = await withTenant(claimsFromSession(session), (db) =>
    db
      .select({
        productoId: productoVariantes.productoId,
        id: productoVariantes.id,
        nombre: productoVariantes.nombre,
        precio: productoVariantesPrecios.precio,
        orden: productoVariantes.orden,
        esDefault: productoVariantes.esDefault,
      })
      .from(productoVariantes)
      .leftJoin(
        productoVariantesPrecios,
        and(
          eq(productoVariantes.id, productoVariantesPrecios.varianteId),
          isNull(productoVariantesPrecios.vigentaHsta)
        )
      )
      .where(
        and(
          eq(productoVariantes.restauranteId, session.restauranteId),
          eq(productoVariantes.activo, true),
          isNull(productoVariantes.deletedAt)
        )
      )
      .orderBy(asc(productoVariantes.orden))
  );

  return rows.map((r) => ({
    productoId: r.productoId,
    id: r.id,
    nombre: r.nombre,
    precio: r.precio ?? '0',
    orden: r.orden,
    esDefault: r.esDefault,
  }));
}

/**
 * Agrega una variante a un plato (presentación con precio fijo). La primera
 * variante de un producto queda como default. El orden es incremental.
 */
export async function agregarVariante(
  productoId: string,
  data: { nombre: string; precio: number; esDefault?: boolean }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tenés permiso para gestionar el menú' };
    }

    const nombre = data.nombre?.trim();
    if (!nombre) {
      return { success: false, message: 'El nombre de la variante es obligatorio' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [producto] = await db
        .select({ id: productos.id })
        .from(productos)
        .where(and(eq(productos.id, productoId), eq(productos.restauranteId, session.restauranteId)));
      if (!producto) {
        return { success: false, message: 'Producto no encontrado' };
      }

      await db.transaction(async (tx) => {
        const existentes = await tx
          .select({ orden: productoVariantes.orden })
          .from(productoVariantes)
          .where(
            and(
              eq(productoVariantes.productoId, productoId),
              eq(productoVariantes.activo, true),
              isNull(productoVariantes.deletedAt)
            )
          );
        const orden = existentes.reduce((max, v) => Math.max(max, v.orden), -1) + 1;
        const esDefault = data.esDefault ?? existentes.length === 0;

        const [nueva] = await tx
          .insert(productoVariantes)
          .values({
            restauranteId: session.restauranteId,
            productoId,
            nombre,
            orden,
            esDefault,
          })
          .returning();

        await tx.insert(productoVariantesPrecios).values({
          restauranteId: session.restauranteId,
          varianteId: nueva.id,
          precio: (data.precio || 0).toString(),
          creadoPor: session.user.id,
        });
      });

      return { success: true, message: 'Variante agregada' };
    });

    if (res.success) revalidateTag(`carta-${session.restauranteId}`, 'default');
    return res;
  } catch (error) {
    console.error('[agregarVariante]', error);
    return { success: false, message: 'Error al agregar la variante' };
  }
}

/**
 * Cambia el precio absoluto de una variante (ledger append-only).
 */
export async function editarPrecioVariante(varianteId: string, nuevoPrecio: number) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManagePrices')) {
      return { success: false, message: 'No tenés permiso para modificar precios' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [variante] = await db
        .select({ id: productoVariantes.id })
        .from(productoVariantes)
        .where(
          and(eq(productoVariantes.id, varianteId), eq(productoVariantes.restauranteId, session.restauranteId))
        );
      if (!variante) {
        return { success: false, message: 'Variante no encontrada' };
      }

      await db.transaction(async (tx) => {
        // 1. Cerrar el precio vigente
        await tx
          .update(productoVariantesPrecios)
          .set({ vigentaHsta: new Date() })
          .where(
            and(
              eq(productoVariantesPrecios.varianteId, varianteId),
              eq(productoVariantesPrecios.restauranteId, session.restauranteId),
              isNull(productoVariantesPrecios.vigentaHsta)
            )
          );

        // 2. Insertar el nuevo precio
        await tx.insert(productoVariantesPrecios).values({
          restauranteId: session.restauranteId,
          varianteId,
          precio: nuevoPrecio.toString(),
          creadoPor: session.user.id,
        });
      });

      return { success: true, message: 'Precio actualizado' };
    });

    if (res.success) revalidateTag(`carta-${session.restauranteId}`, 'default');
    return res;
  } catch (error) {
    console.error('[editarPrecioVariante]', error);
    return { success: false, message: 'Error al actualizar el precio' };
  }
}

/**
 * Da de baja una variante (soft delete). Si era la default, traspasa la marca a
 * la primera variante activa restante.
 */
export async function eliminarVariante(productoId: string, varianteId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tenés permiso para gestionar el menú' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [variante] = await db
        .select({ id: productoVariantes.id, esDefault: productoVariantes.esDefault })
        .from(productoVariantes)
        .where(
          and(
            eq(productoVariantes.id, varianteId),
            eq(productoVariantes.productoId, productoId),
            eq(productoVariantes.restauranteId, session.restauranteId)
          )
        );
      if (!variante) {
        return { success: false, message: 'Variante no encontrada' };
      }

      await db.transaction(async (tx) => {
        await tx
          .update(productoVariantes)
          .set({ deletedAt: new Date(), activo: false })
          .where(
            and(eq(productoVariantes.id, varianteId), eq(productoVariantes.restauranteId, session.restauranteId))
          );

        if (variante.esDefault) {
          const [siguiente] = await tx
            .select({ id: productoVariantes.id })
            .from(productoVariantes)
            .where(
              and(
                eq(productoVariantes.productoId, productoId),
                eq(productoVariantes.activo, true),
                isNull(productoVariantes.deletedAt)
              )
            )
            .orderBy(asc(productoVariantes.orden))
            .limit(1);
          if (siguiente) {
            await tx
              .update(productoVariantes)
              .set({ esDefault: true })
              .where(eq(productoVariantes.id, siguiente.id));
          }
        }
      });

      return { success: true, message: 'Variante eliminada' };
    });

    if (res.success) revalidateTag(`carta-${session.restauranteId}`, 'default');
    return res;
  } catch (error) {
    console.error('[eliminarVariante]', error);
    return { success: false, message: 'Error al eliminar la variante' };
  }
}

/**
 * Marca una variante como la opción por defecto (preseleccionada) del plato,
 * desmarcando las demás.
 */
export async function marcarVarianteDefault(productoId: string, varianteId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tenés permiso para gestionar el menú' };
    }

    await withTenant(claimsFromSession(session), (db) =>
      db.transaction(async (tx) => {
        await tx
          .update(productoVariantes)
          .set({ esDefault: false })
          .where(
            and(
              eq(productoVariantes.productoId, productoId),
              eq(productoVariantes.restauranteId, session.restauranteId)
            )
          );
        await tx
          .update(productoVariantes)
          .set({ esDefault: true })
          .where(
            and(
              eq(productoVariantes.id, varianteId),
              eq(productoVariantes.productoId, productoId),
              eq(productoVariantes.restauranteId, session.restauranteId)
            )
          );
      })
    );

    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Variante por defecto actualizada' };
  } catch (error) {
    console.error('[marcarVarianteDefault]', error);
    return { success: false, message: 'Error al actualizar la variante por defecto' };
  }
}
