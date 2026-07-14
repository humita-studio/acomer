'use server';

import { db } from '@/shared/db';
import { landingConfig, restaurantes } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { withTenant } from '@/shared/db/secure-wrapper';
import {
  borrarImagenCloudinary,
  firmarUpload,
  folderRestaurante,
  urlEntrega,
} from '@/shared/lib/cloudinary';

/** Portada del hero o logo del local. */
export type ImagenLocalKind = 'cover' | 'logo';

function assertAdminSession() {
  return getCurrentSession().then((session) => {
    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
      return null;
    }
    return session;
  });
}

async function revalidateLanding(restauranteId: string) {
  revalidatePath('/admin/configuracion');
  const [rest] = await db
    .select({ slug: restaurantes.slug })
    .from(restaurantes)
    .where(eq(restaurantes.id, restauranteId))
    .limit(1);
  if (rest?.slug) revalidatePath(`/${rest.slug}`);
}

function publicIdFor(kind: ImagenLocalKind): string {
  return kind === 'logo' ? 'logo' : 'cover';
}

function entregaOpts(kind: ImagenLocalKind, version: number | string) {
  if (kind === 'logo') {
    return { width: 400, height: 400, crop: 'fill' as const, version };
  }
  return { width: 1400, height: 900, crop: 'fill' as const, version };
}

/**
 * Genera firma de Cloudinary para que el browser suba directo (sin pasar
 * el archivo por nuestro server). El public_id es fijo por restaurante
 * (`cover` o `logo`) para que un reemplazo pise el asset anterior.
 */
export async function obtenerFirmaUploadImagenAction(kind: ImagenLocalKind = 'cover') {
  try {
    const session = await assertAdminSession();
    if (!session) return { success: false as const, message: 'No autorizado' };

    const k: ImagenLocalKind = kind === 'logo' ? 'logo' : 'cover';
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = folderRestaurante(session.restauranteId);
    const publicId = publicIdFor(k);

    const firmado = firmarUpload({ folder, publicId, timestamp });
    return { success: true as const, kind: k, ...firmado };
  } catch (error) {
    console.error('[obtenerFirmaUploadImagenAction]', error);
    return {
      success: false as const,
      message:
        error instanceof Error && error.message.includes('CLOUDINARY')
          ? 'Cloudinary no está configurado. Revisá las variables de entorno.'
          : 'No se pudo preparar la subida',
    };
  }
}

/**
 * Tras un upload exitoso en el cliente, persiste URL + public_id en landing_config
 * y borra el asset anterior si el public_id cambió (caso edge).
 */
export async function guardarImagenLocalAction(input: {
  publicId: string;
  kind?: ImagenLocalKind;
  /**
   * Versión que devuelve Cloudinary en el upload. Va en la URL (`/v{version}/`)
   * para que al re-subir con el mismo public_id el browser/CDN no sirvan la vieja.
   */
  version?: number | string;
  /** secure_url crudo de Cloudinary; lo normalizamos a URL de entrega optimizada. */
  secureUrl?: string;
}) {
  try {
    const session = await assertAdminSession();
    if (!session) return { success: false as const, message: 'No autorizado' };

    const kind: ImagenLocalKind = input.kind === 'logo' ? 'logo' : 'cover';
    const publicId = (input.publicId ?? '').trim();
    if (!publicId) return { success: false as const, message: 'public_id inválido' };

    // Solo aceptamos assets del folder del tenant (evita public_ids ajenos).
    const expectedPrefix = `${folderRestaurante(session.restauranteId)}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      return { success: false as const, message: 'Imagen no pertenece a este local' };
    }

    // Fallback a timestamp si el cliente no mandó version (no debería pasar).
    const version = input.version ?? Math.floor(Date.now() / 1000);
    const imagenUrl = urlEntrega(publicId, entregaOpts(kind, version));

    const [prev] = await db
      .select({
        imagenPublicId: landingConfig.imagenPublicId,
        logoPublicId: landingConfig.logoPublicId,
      })
      .from(landingConfig)
      .where(eq(landingConfig.restauranteId, session.restauranteId))
      .limit(1);

    const now = new Date();
    if (kind === 'logo') {
      await withTenant(claimsFromSession(session), (tx) =>
        tx
          .insert(landingConfig)
          .values({
            restauranteId: session.restauranteId,
            logoUrl: imagenUrl,
            logoPublicId: publicId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: landingConfig.restauranteId,
            set: {
              logoUrl: imagenUrl,
              logoPublicId: publicId,
              updatedAt: now,
            },
          }),
      );
      if (prev?.logoPublicId && prev.logoPublicId !== publicId) {
        const del = await borrarImagenCloudinary(prev.logoPublicId);
        if (!del.ok) {
          console.warn(
            '[guardarImagenLocalAction] no se pudo borrar logo anterior',
            prev.logoPublicId,
            del.result,
          );
        }
      }
    } else {
      await withTenant(claimsFromSession(session), (tx) =>
        tx
          .insert(landingConfig)
          .values({
            restauranteId: session.restauranteId,
            imagenUrl,
            imagenPublicId: publicId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: landingConfig.restauranteId,
            set: {
              imagenUrl,
              imagenPublicId: publicId,
              updatedAt: now,
            },
          }),
      );
      if (prev?.imagenPublicId && prev.imagenPublicId !== publicId) {
        const del = await borrarImagenCloudinary(prev.imagenPublicId);
        if (!del.ok) {
          console.warn(
            '[guardarImagenLocalAction] no se pudo borrar asset anterior',
            prev.imagenPublicId,
            del.result,
          );
        }
      }
    }

    await revalidateLanding(session.restauranteId);
    return {
      success: true as const,
      kind,
      imagenUrl,
      imagenPublicId: publicId,
    };
  } catch (error) {
    console.error('[guardarImagenLocalAction]', error);
    return { success: false as const, message: 'No se pudo guardar la imagen' };
  }
}

/**
 * Quita la portada o el logo: primero destruye el asset en Cloudinary
 * y solo si eso sale bien limpia la DB.
 */
export async function eliminarImagenLocalAction(kind: ImagenLocalKind = 'cover') {
  try {
    const session = await assertAdminSession();
    if (!session) return { success: false as const, message: 'No autorizado' };

    const k: ImagenLocalKind = kind === 'logo' ? 'logo' : 'cover';

    const [prev] = await db
      .select({
        imagenPublicId: landingConfig.imagenPublicId,
        logoPublicId: landingConfig.logoPublicId,
      })
      .from(landingConfig)
      .where(eq(landingConfig.restauranteId, session.restauranteId))
      .limit(1);

    const publicId =
      (k === 'logo' ? prev?.logoPublicId : prev?.imagenPublicId)?.trim() ?? '';

    // 1) Borrar en Cloudinary primero para no dejar huérfanos.
    if (publicId) {
      const del = await borrarImagenCloudinary(publicId);
      if (!del.ok) {
        return {
          success: false as const,
          message:
            'No se pudo borrar la imagen en Cloudinary. Reintentá en un momento.',
        };
      }
    }

    // 2) Limpiar referencia en DB.
    const now = new Date();
    if (k === 'logo') {
      await withTenant(claimsFromSession(session), (tx) =>
        tx
          .insert(landingConfig)
          .values({
            restauranteId: session.restauranteId,
            logoUrl: '',
            logoPublicId: '',
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: landingConfig.restauranteId,
            set: {
              logoUrl: '',
              logoPublicId: '',
              updatedAt: now,
            },
          }),
      );
    } else {
      await withTenant(claimsFromSession(session), (tx) =>
        tx
          .insert(landingConfig)
          .values({
            restauranteId: session.restauranteId,
            imagenUrl: '',
            imagenPublicId: '',
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: landingConfig.restauranteId,
            set: {
              imagenUrl: '',
              imagenPublicId: '',
              updatedAt: now,
            },
          }),
      );
    }

    await revalidateLanding(session.restauranteId);
    return { success: true as const, deletedFromCloudinary: Boolean(publicId) };
  } catch (error) {
    console.error('[eliminarImagenLocalAction]', error);
    return { success: false as const, message: 'No se pudo eliminar la imagen' };
  }
}
