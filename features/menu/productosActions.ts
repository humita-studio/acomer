'use server';

import { db } from '@/shared/db';
import { productos, productosPrecios } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';

/**
 * Lista los productos del menú con su precio vigente. Estado de servidor que
 * consume TanStack Query en el admin (siembra `initialData`).
 */
export async function obtenerProductosMenu() {
  const session = await getCurrentSession();
  if (!session) return [];
  return db
    .select({
      id: productos.id,
      categoriaId: productos.categoriaId,
      nombre: productos.nombre,
      descripcion: productos.descripcion,
      precio: productosPrecios.precio,
      permiteAdicionales: productos.permiteAdicionales,
    })
    .from(productos)
    .innerJoin(
      productosPrecios,
      and(eq(productos.id, productosPrecios.productoId), isNull(productosPrecios.vigentaHsta))
    )
    .where(and(eq(productos.restauranteId, session.restauranteId), isNull(productos.deletedAt)));
}

export async function crearProducto(data: {
  categoriaId: string;
  nombre: string;
  descripcion?: string;
  precio: number;
}) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No autorizado' };
    }

    await db.transaction(async (tx) => {
      const [nuevoProducto] = await tx
        .insert(productos)
        .values({
          restauranteId: session.restauranteId,
          categoriaId: data.categoriaId,
          nombre: data.nombre,
          descripcion: data.descripcion || null,
        })
        .returning();

      await tx.insert(productosPrecios).values({
        restauranteId: session.restauranteId,
        productoId: nuevoProducto.id,
        precio: data.precio.toString(),
        creadoPor: session.user.id,
      });
    });

    return { success: true, message: 'Producto creado exitosamente' };
  } catch (error) {
    console.error('[crearProducto]', error);
    return { success: false, message: 'Error al crear el producto' };
  }
}

export async function editarProducto(id: string, data: { nombre: string; descripcion?: string }) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No autorizado' };
    }

    await db
      .update(productos)
      .set({
        nombre: data.nombre,
        descripcion: data.descripcion || null,
      })
      .where(
        and(
          eq(productos.id, id),
          eq(productos.restauranteId, session.restauranteId)
        )
      );

    revalidatePath('/admin/menu');
    return { success: true, message: 'Producto actualizado' };
  } catch (error) {
    console.error('[editarProducto]', error);
    return { success: false, message: 'Error al actualizar producto' };
  }
}

export async function modificarPrecioProducto(productoId: string, nuevoPrecio: number) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManagePrices')) {
      return { success: false, message: 'No tienes permiso para modificar precios' };
    }

    await db.transaction(async (tx) => {
      // 1. Cerrar el precio actual (vigente_hasta = now)
      await tx
        .update(productosPrecios)
        .set({ vigentaHsta: new Date() })
        .where(
          and(
            eq(productosPrecios.productoId, productoId),
            eq(productosPrecios.restauranteId, session.restauranteId),
            isNull(productosPrecios.vigentaHsta)
          )
        );

      // 2. Insertar el nuevo precio
      await tx.insert(productosPrecios).values({
        restauranteId: session.restauranteId,
        productoId,
        precio: nuevoPrecio.toString(),
        creadoPor: session.user.id,
      });
    });

    return { success: true, message: 'Precio actualizado' };
  } catch (error) {
    console.error('[modificarPrecioProducto]', error);
    return { success: false, message: 'Error al actualizar el precio' };
  }
}

export async function eliminarProducto(id: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No autorizado' };
    }

    // Soft delete
    await db
      .update(productos)
      .set({ deletedAt: new Date(), activo: false })
      .where(
        and(
          eq(productos.id, id),
          eq(productos.restauranteId, session.restauranteId)
        )
      );

    return { success: true, message: 'Producto eliminado' };
  } catch (error) {
    console.error('[eliminarProducto]', error);
    return { success: false, message: 'Error al eliminar producto' };
  }
}
