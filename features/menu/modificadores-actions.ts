'use server';

import { db } from '@/shared/db';
import {
  modificadores,
  modificadoresPrecios,
  productos,
  productoModificadoresDisponibles,
} from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';

export type VarianteMenu = {
  productoId: string;
  id: string;
  nombre: string;
  precio: string;
};

/**
 * Lista todas las variantes (adicionales) del menú del restaurante, agrupables
 * por plato. Estado de servidor que consume TanStack Query en el admin.
 */
export async function obtenerVariantesMenu(): Promise<VarianteMenu[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  return db
    .select({
      productoId: productoModificadoresDisponibles.productoId,
      id: modificadores.id,
      nombre: modificadores.nombre,
      precio: modificadoresPrecios.precioExtra,
    })
    .from(productoModificadoresDisponibles)
    .innerJoin(productos, eq(productoModificadoresDisponibles.productoId, productos.id))
    .innerJoin(modificadores, eq(productoModificadoresDisponibles.modificadorId, modificadores.id))
    .innerJoin(
      modificadoresPrecios,
      and(
        eq(modificadores.id, modificadoresPrecios.modificadorId),
        isNull(modificadoresPrecios.vigentaHsta)
      )
    )
    .where(
      and(eq(productos.restauranteId, session.restauranteId), isNull(modificadores.deletedAt))
    );
}

/**
 * Agrega una variante (adicional) propia de un plato.
 * Crea el modificador + su precio y lo vincula al producto en una sola operación.
 * Al agregar la primera, el plato pasa a permitir adicionales.
 */
export async function agregarVarianteAPlato(
  productoId: string,
  data: { nombre: string; precioExtra: number }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tienes permiso para gestionar el menú' };
    }

    const nombre = data.nombre?.trim();
    if (!nombre) {
      return { success: false, message: 'El nombre de la variante es obligatorio' };
    }

    // Validar que el producto pertenece al restaurante de la sesión
    const [producto] = await db
      .select({ id: productos.id })
      .from(productos)
      .where(and(eq(productos.id, productoId), eq(productos.restauranteId, session.restauranteId)));

    if (!producto) {
      return { success: false, message: 'Producto no encontrado' };
    }

    await db.transaction(async (tx) => {
      const [nuevo] = await tx
        .insert(modificadores)
        .values({
          restauranteId: session.restauranteId,
          nombre,
        })
        .returning();

      await tx.insert(modificadoresPrecios).values({
        restauranteId: session.restauranteId,
        modificadorId: nuevo.id,
        precioExtra: (data.precioExtra || 0).toString(),
      });

      await tx
        .insert(productoModificadoresDisponibles)
        .values({ productoId, modificadorId: nuevo.id });

      await tx
        .update(productos)
        .set({ permiteAdicionales: true })
        .where(and(eq(productos.id, productoId), eq(productos.restauranteId, session.restauranteId)));
    });

    return { success: true, message: 'Variante agregada' };
  } catch (error) {
    console.error('[agregarVarianteAPlato]', error);
    return { success: false, message: 'Error al agregar la variante' };
  }
}

/**
 * Cambia el precio extra de una variante (ledger append-only).
 */
export async function editarPrecioVariante(modificadorId: string, nuevoPrecio: number) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManagePrices')) {
      return { success: false, message: 'No tienes permiso para modificar precios' };
    }

    const [modificador] = await db
      .select({ id: modificadores.id })
      .from(modificadores)
      .where(
        and(eq(modificadores.id, modificadorId), eq(modificadores.restauranteId, session.restauranteId))
      );

    if (!modificador) {
      return { success: false, message: 'Variante no encontrada' };
    }

    await db.transaction(async (tx) => {
      // 1. Cerrar el precio vigente
      await tx
        .update(modificadoresPrecios)
        .set({ vigentaHsta: new Date() })
        .where(
          and(
            eq(modificadoresPrecios.modificadorId, modificadorId),
            eq(modificadoresPrecios.restauranteId, session.restauranteId),
            isNull(modificadoresPrecios.vigentaHsta)
          )
        );

      // 2. Insertar el nuevo precio
      await tx.insert(modificadoresPrecios).values({
        restauranteId: session.restauranteId,
        modificadorId,
        precioExtra: nuevoPrecio.toString(),
      });
    });

    return { success: true, message: 'Precio actualizado' };
  } catch (error) {
    console.error('[editarPrecioVariante]', error);
    return { success: false, message: 'Error al actualizar el precio' };
  }
}

/**
 * Elimina una variante de un plato: la desvincula y la da de baja.
 * Si el plato se queda sin variantes, deja de permitir adicionales.
 */
export async function eliminarVarianteDePlato(productoId: string, modificadorId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No tienes permiso para gestionar el menú' };
    }

    const [producto] = await db
      .select({ id: productos.id })
      .from(productos)
      .where(and(eq(productos.id, productoId), eq(productos.restauranteId, session.restauranteId)));

    if (!producto) {
      return { success: false, message: 'Producto no encontrado' };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(productoModificadoresDisponibles)
        .where(
          and(
            eq(productoModificadoresDisponibles.productoId, productoId),
            eq(productoModificadoresDisponibles.modificadorId, modificadorId)
          )
        );

      // La variante es propia del plato: darla de baja
      await tx
        .update(modificadores)
        .set({ deletedAt: new Date(), disponible: false })
        .where(
          and(eq(modificadores.id, modificadorId), eq(modificadores.restauranteId, session.restauranteId))
        );

      const restantes = await tx
        .select({ modificadorId: productoModificadoresDisponibles.modificadorId })
        .from(productoModificadoresDisponibles)
        .where(eq(productoModificadoresDisponibles.productoId, productoId));

      if (restantes.length === 0) {
        await tx
          .update(productos)
          .set({ permiteAdicionales: false })
          .where(and(eq(productos.id, productoId), eq(productos.restauranteId, session.restauranteId)));
      }
    });

    return { success: true, message: 'Variante eliminada' };
  } catch (error) {
    console.error('[eliminarVarianteDePlato]', error);
    return { success: false, message: 'Error al eliminar la variante' };
  }
}
