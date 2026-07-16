'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { productos } from '@/shared/db/schema';
import {
  borrarImagenCloudinary,
  firmarUpload,
  folderRestaurante,
  urlEntrega,
} from '@/shared/lib/cloudinary';

function assertMenuSession() {
  return getCurrentSession().then((session) => {
    if (!session || !hasPermission(session.role, 'canManageMenu')) return null;
    return session;
  });
}

/**
 * Firma upload Cloudinary para foto de producto.
 * public_id: `producto_{productoId}` dentro del folder del restaurante.
 */
export async function obtenerFirmaUploadProductoAction(productoId: string) {
  try {
    const session = await assertMenuSession();
    if (!session) return { success: false as const, message: 'No autorizado' };
    if (!productoId?.trim()) return { success: false as const, message: 'Producto inválido' };

    const [row] = await withTenant(claimsFromSession(session), (db) =>
      db
        .select({ id: productos.id })
        .from(productos)
        .where(
          and(
            eq(productos.id, productoId),
            eq(productos.restauranteId, session.restauranteId),
            isNull(productos.deletedAt),
          ),
        )
        .limit(1),
    );
    if (!row) return { success: false as const, message: 'Producto no encontrado' };

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = folderRestaurante(session.restauranteId);
    const publicId = `producto_${productoId}`;
    const firmado = firmarUpload({ folder, publicId, timestamp });
    return { success: true as const, ...firmado };
  } catch (error) {
    console.error('[obtenerFirmaUploadProductoAction]', error);
    return {
      success: false as const,
      message:
        error instanceof Error && error.message.includes('CLOUDINARY')
          ? 'Cloudinary no está configurado'
          : 'No se pudo preparar la subida',
    };
  }
}

export async function guardarImagenProductoAction(input: {
  productoId: string;
  publicId: string;
  version?: number | string;
}) {
  try {
    const session = await assertMenuSession();
    if (!session) return { success: false as const, message: 'No autorizado' };

    const productoId = input.productoId?.trim();
    const publicId = input.publicId?.trim();
    if (!productoId || !publicId) {
      return { success: false as const, message: 'Datos inválidos' };
    }

    const expectedPrefix = `${folderRestaurante(session.restauranteId)}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      return { success: false as const, message: 'Imagen no pertenece a este local' };
    }

    const version = input.version ?? Math.floor(Date.now() / 1000);
    const imagenUrl = urlEntrega(publicId, {
      width: 800,
      height: 800,
      crop: 'fill',
      version,
    });

    const [prev] = await withTenant(claimsFromSession(session), (db) =>
      db
        .select({ imagenPublicId: productos.imagenPublicId })
        .from(productos)
        .where(
          and(
            eq(productos.id, productoId),
            eq(productos.restauranteId, session.restauranteId),
            isNull(productos.deletedAt),
          ),
        )
        .limit(1),
    );
    if (!prev) return { success: false as const, message: 'Producto no encontrado' };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(productos)
        .set({ imagenUrl, imagenPublicId: publicId })
        .where(
          and(
            eq(productos.id, productoId),
            eq(productos.restauranteId, session.restauranteId),
          ),
        ),
    );

    if (prev.imagenPublicId && prev.imagenPublicId !== publicId) {
      const del = await borrarImagenCloudinary(prev.imagenPublicId);
      if (!del.ok) {
        console.warn('[guardarImagenProductoAction] borrar anterior', del.result);
      }
    }

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true as const, imagenUrl, imagenPublicId: publicId };
  } catch (error) {
    console.error('[guardarImagenProductoAction]', error);
    return { success: false as const, message: 'No se pudo guardar la imagen' };
  }
}

export async function eliminarImagenProductoAction(productoId: string) {
  try {
    const session = await assertMenuSession();
    if (!session) return { success: false as const, message: 'No autorizado' };
    if (!productoId?.trim()) return { success: false as const, message: 'Producto inválido' };

    const [prev] = await withTenant(claimsFromSession(session), (db) =>
      db
        .select({ imagenPublicId: productos.imagenPublicId })
        .from(productos)
        .where(
          and(
            eq(productos.id, productoId),
            eq(productos.restauranteId, session.restauranteId),
            isNull(productos.deletedAt),
          ),
        )
        .limit(1),
    );
    if (!prev) return { success: false as const, message: 'Producto no encontrado' };

    const publicId = prev.imagenPublicId?.trim() ?? '';
    if (publicId) {
      const del = await borrarImagenCloudinary(publicId);
      if (!del.ok) {
        return {
          success: false as const,
          message: 'No se pudo borrar la imagen en Cloudinary',
        };
      }
    }

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(productos)
        .set({ imagenUrl: null, imagenPublicId: null })
        .where(
          and(
            eq(productos.id, productoId),
            eq(productos.restauranteId, session.restauranteId),
          ),
        ),
    );

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');
    return { success: true as const };
  } catch (error) {
    console.error('[eliminarImagenProductoAction]', error);
    return { success: false as const, message: 'No se pudo eliminar la imagen' };
  }
}
