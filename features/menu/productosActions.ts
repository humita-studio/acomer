'use server';

import { db } from '@/shared/db';
import {
  productos,
  productosPrecios,
  productoVariantes,
  productoVariantesPrecios,
  modificadores,
  modificadoresPrecios,
  productoModificadoresDisponibles,
} from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath, revalidateTag } from 'next/cache';

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
      activo: productos.activo,
    })
    .from(productos)
    // leftJoin: un producto "con variantes" no tiene precio base (el precio vive en
    // cada variante), así que igual debe aparecer. `precio` queda null para ésos.
    .leftJoin(
      productosPrecios,
      and(eq(productos.id, productosPrecios.productoId), isNull(productosPrecios.vigentaHsta))
    )
    .where(and(eq(productos.restauranteId, session.restauranteId), isNull(productos.deletedAt)));
}

export async function crearProducto(data: {
  categoriaId: string;
  nombre: string;
  descripcion?: string;
  /** Precio único. Se omite si el producto se crea con variantes. */
  precio?: number;
  disponible?: boolean;
  /** Adicionales (extras aditivos) a crear junto con el producto. */
  adicionales?: { nombre: string; precioExtra: number }[];
  /** Variantes (presentaciones de precio fijo). Si hay, el producto NO lleva precio base. */
  variantes?: { nombre: string; precio: number }[];
}) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No autorizado' };
    }

    const adicionalesValidos = (data.adicionales ?? [])
      .map((a) => ({ nombre: a.nombre?.trim() ?? '', precioExtra: a.precioExtra }))
      .filter((a) => a.nombre.length > 0);

    const variantesValidas = (data.variantes ?? [])
      .map((v) => ({ nombre: v.nombre?.trim() ?? '', precio: v.precio }))
      .filter((v) => v.nombre.length > 0);
    const conVariantes = variantesValidas.length > 0;

    if (!conVariantes && (!data.precio || data.precio <= 0)) {
      return { success: false, message: 'Ingresá un precio o al menos una variante' };
    }

    await db.transaction(async (tx) => {
      const [nuevoProducto] = await tx
        .insert(productos)
        .values({
          restauranteId: session.restauranteId,
          categoriaId: data.categoriaId,
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          activo: data.disponible ?? true,
          permiteAdicionales: adicionalesValidos.length > 0,
        })
        .returning();

      // Precio: por variante (sin precio base) o único en productos_precios.
      if (conVariantes) {
        for (let i = 0; i < variantesValidas.length; i++) {
          const v = variantesValidas[i];
          const [nuevaVar] = await tx
            .insert(productoVariantes)
            .values({
              restauranteId: session.restauranteId,
              productoId: nuevoProducto.id,
              nombre: v.nombre,
              orden: i,
              esDefault: i === 0,
            })
            .returning();

          await tx.insert(productoVariantesPrecios).values({
            restauranteId: session.restauranteId,
            varianteId: nuevaVar.id,
            precio: (v.precio || 0).toString(),
            creadoPor: session.user.id,
          });
        }
      } else {
        await tx.insert(productosPrecios).values({
          restauranteId: session.restauranteId,
          productoId: nuevoProducto.id,
          precio: (data.precio || 0).toString(),
          creadoPor: session.user.id,
        });
      }

      // Adicionales propios del plato: modificador + precio + vínculo.
      for (const adicional of adicionalesValidos) {
        const [nuevoMod] = await tx
          .insert(modificadores)
          .values({ restauranteId: session.restauranteId, nombre: adicional.nombre })
          .returning();

        await tx.insert(modificadoresPrecios).values({
          restauranteId: session.restauranteId,
          modificadorId: nuevoMod.id,
          precioExtra: (adicional.precioExtra || 0).toString(),
        });

        await tx
          .insert(productoModificadoresDisponibles)
          .values({ productoId: nuevoProducto.id, modificadorId: nuevoMod.id });
      }
    });

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Producto creado exitosamente' };
  } catch (error) {
    console.error('[crearProducto]', error);
    return { success: false, message: 'Error al crear el producto' };
  }
}

export async function editarProducto(
  id: string,
  data: { nombre: string; descripcion?: string; categoriaId?: string }
) {
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
        ...(data.categoriaId ? { categoriaId: data.categoriaId } : {}),
      })
      .where(
        and(
          eq(productos.id, id),
          eq(productos.restauranteId, session.restauranteId)
        )
      );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Producto actualizado' };
  } catch (error) {
    console.error('[editarProducto]', error);
    return { success: false, message: 'Error al actualizar producto' };
  }
}

/**
 * Cambia la disponibilidad de un producto en la carta (campo `activo`).
 * `false` lo marca como "agotado": deja de ofrecerse a los clientes.
 */
export async function cambiarDisponibilidadProducto(productoId: string, disponible: boolean) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No autorizado' };
    }

    await db
      .update(productos)
      .set({ activo: disponible })
      .where(
        and(
          eq(productos.id, productoId),
          eq(productos.restauranteId, session.restauranteId),
          isNull(productos.deletedAt)
        )
      );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: disponible ? 'Producto disponible' : 'Producto marcado agotado' };
  } catch (error) {
    console.error('[cambiarDisponibilidadProducto]', error);
    return { success: false, message: 'Error al cambiar la disponibilidad' };
  }
}

/**
 * Duplica un producto: copia nombre (con sufijo), descripción, categoría,
 * disponibilidad, su precio vigente y sus variantes.
 */
export async function duplicarProducto(productoId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageMenu')) {
      return { success: false, message: 'No autorizado' };
    }

    const [original] = await db
      .select({
        categoriaId: productos.categoriaId,
        nombre: productos.nombre,
        descripcion: productos.descripcion,
        permiteAdicionales: productos.permiteAdicionales,
        activo: productos.activo,
      })
      .from(productos)
      .where(
        and(
          eq(productos.id, productoId),
          eq(productos.restauranteId, session.restauranteId),
          isNull(productos.deletedAt)
        )
      );

    if (!original) {
      return { success: false, message: 'Producto no encontrado' };
    }

    const [{ precio } = { precio: '0' }] = await db
      .select({ precio: productosPrecios.precio })
      .from(productosPrecios)
      .where(
        and(
          eq(productosPrecios.productoId, productoId),
          eq(productosPrecios.restauranteId, session.restauranteId),
          isNull(productosPrecios.vigentaHsta)
        )
      );

    // Adicionales del original (nombre + precio extra vigente) para replicarlos.
    const adicionales = await db
      .select({
        nombre: modificadores.nombre,
        precioExtra: modificadoresPrecios.precioExtra,
      })
      .from(productoModificadoresDisponibles)
      .innerJoin(
        modificadores,
        eq(productoModificadoresDisponibles.modificadorId, modificadores.id)
      )
      .innerJoin(
        modificadoresPrecios,
        and(
          eq(modificadores.id, modificadoresPrecios.modificadorId),
          isNull(modificadoresPrecios.vigentaHsta)
        )
      )
      .where(
        and(
          eq(productoModificadoresDisponibles.productoId, productoId),
          isNull(modificadores.deletedAt)
        )
      );

    await db.transaction(async (tx) => {
      const [copia] = await tx
        .insert(productos)
        .values({
          restauranteId: session.restauranteId,
          categoriaId: original.categoriaId,
          nombre: `${original.nombre} (copia)`,
          descripcion: original.descripcion,
          activo: original.activo,
          permiteAdicionales: original.permiteAdicionales,
        })
        .returning();

      await tx.insert(productosPrecios).values({
        restauranteId: session.restauranteId,
        productoId: copia.id,
        precio: precio ?? '0',
        creadoPor: session.user.id,
      });

      for (const adicional of adicionales) {
        const [nuevoMod] = await tx
          .insert(modificadores)
          .values({ restauranteId: session.restauranteId, nombre: adicional.nombre })
          .returning();

        await tx.insert(modificadoresPrecios).values({
          restauranteId: session.restauranteId,
          modificadorId: nuevoMod.id,
          precioExtra: adicional.precioExtra,
        });

        await tx
          .insert(productoModificadoresDisponibles)
          .values({ productoId: copia.id, modificadorId: nuevoMod.id });
      }
    });

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Producto duplicado' };
  } catch (error) {
    console.error('[duplicarProducto]', error);
    return { success: false, message: 'Error al duplicar el producto' };
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

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
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

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true, message: 'Producto eliminado' };
  } catch (error) {
    console.error('[eliminarProducto]', error);
    return { success: false, message: 'Error al eliminar producto' };
  }
}
