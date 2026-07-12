import { v2 as cloudinary } from 'cloudinary';

/** Carpeta raíz en Cloudinary para assets de acomer. */
export const CLOUDINARY_ROOT_FOLDER = 'acomer';

/** Ancho máximo al subir (Cloudinary limita y el cliente ya redimensiona). */
export const UPLOAD_MAX_WIDTH = 1600;

/** Tipos MIME aceptados para la imagen del local. */
export const IMAGEN_MIME_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** Tamaño máximo del archivo *después* de comprimir en el cliente (bytes). */
export const IMAGEN_MAX_BYTES = 1_200_000; // ~1.2 MB

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} para Cloudinary`);
  }
  return value;
}

/** Configura el SDK una sola vez por proceso (idempotente). */
export function configureCloudinary() {
  cloudinary.config({
    cloud_name: requireEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
    api_key: requireEnv('CLOUDINARY_API_KEY'),
    api_secret: requireEnv('CLOUDINARY_API_SECRET'),
    secure: true,
  });
  return cloudinary;
}

export function getCloudName(): string {
  return requireEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
}

export function getApiKey(): string {
  return requireEnv('CLOUDINARY_API_KEY');
}

/**
 * Carpeta por restaurante: `acomer/restaurantes/{id}`.
 * Aísla assets por tenant y facilita limpieza.
 */
export function folderRestaurante(restauranteId: string): string {
  return `${CLOUDINARY_ROOT_FOLDER}/restaurantes/${restauranteId}`;
}

/**
 * URL de entrega optimizada (formato y calidad automáticos).
 * `w` controla el ancho servido; Cloudinary elige WebP/AVIF según el browser.
 *
 * Importante: incluir `version` (el que devuelve el upload) para invalidar
 * caché de CDN/browser al re-subir con el mismo public_id. Sin eso, la URL
 * queda idéntica y se sigue viendo la foto vieja.
 * Formato: /upload/{transforms}/v{version}/{public_id}
 */
export function urlEntrega(
  publicId: string,
  opts: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'limit' | 'fit';
    /** Versión de Cloudinary post-upload (rompe caché al reemplazar). */
    version?: number | string;
  } = {},
): string {
  const cloud = getCloudName();
  const { width = 1200, height, crop = 'fill', version } = opts;
  const parts = ['f_auto', 'q_auto:good', `c_${crop}`, 'g_auto', `w_${width}`];
  if (height) parts.push(`h_${height}`);
  const versionSeg =
    version != null && String(version).length > 0 ? `v${version}/` : '';
  return `https://res.cloudinary.com/${cloud}/image/upload/${parts.join(',')}/${versionSeg}${publicId}`;
}

/** Params firmados para upload directo del browser a Cloudinary. */
export function firmarUpload(params: {
  folder: string;
  publicId: string;
  timestamp: number;
}): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  transformation: string;
  overwrite: string;
  invalidate: string;
} {
  const cld = configureCloudinary();
  // Límite de tamaño en origen + calidad/formato auto (menos storage y mejor entrega).
  const transformation = `c_limit,w_${UPLOAD_MAX_WIDTH},q_auto:good,f_auto`;
  // Firmamos TODOS los params que el browser enviará (excepto file y api_key).
  const toSign = {
    folder: params.folder,
    invalidate: 'true',
    overwrite: 'true',
    public_id: params.publicId,
    timestamp: params.timestamp,
    transformation,
  };
  const signature = cld.utils.api_sign_request(toSign, requireEnv('CLOUDINARY_API_SECRET'));
  return {
    signature,
    timestamp: params.timestamp,
    apiKey: getApiKey(),
    cloudName: getCloudName(),
    folder: params.folder,
    publicId: params.publicId,
    transformation,
    overwrite: 'true',
    invalidate: 'true',
  };
}

/**
 * Borra un asset por public_id en Cloudinary (Admin API destroy).
 * - `ok`: true si se borró o ya no existía (`not found`).
 * - `result`: respuesta cruda de Cloudinary (`ok` | `not found` | …).
 */
export async function borrarImagenCloudinary(
  publicId: string,
): Promise<{ ok: boolean; result?: string }> {
  if (!publicId) return { ok: true, result: 'skipped' };
  const cld = configureCloudinary();
  try {
    const res = (await cld.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image',
    })) as { result?: string };
    const result = res?.result ?? 'unknown';
    // "not found" cuenta como éxito: el objetivo (que no exista) ya se cumplió.
    const ok = result === 'ok' || result === 'not found';
    if (!ok) {
      console.warn('[cloudinary] destroy respuesta inesperada', publicId, res);
    }
    return { ok, result };
  } catch (err) {
    console.error('[cloudinary] destroy falló', publicId, err);
    return { ok: false };
  }
}
