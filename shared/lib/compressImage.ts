/**
 * Compresión de imagen en el browser (canvas) antes de subir a Cloudinary.
 * Reduce peso de subida y costo de storage: redimensiona y re-encodea a JPEG/WebP.
 */

export type CompressOptions = {
  /** Ancho máximo en px (mantiene aspect ratio). Default 1600. */
  maxWidth?: number;
  /** Alto máximo en px. Default 1600. */
  maxHeight?: number;
  /** Calidad 0–1 para JPEG/WebP. Default 0.82. */
  quality?: number;
  /** Preferir WebP si el browser lo soporta. Default true. */
  preferWebp?: boolean;
};

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  preferWebp: true,
};

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('No se pudo comprimir la imagen'));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

/**
 * Redimensiona y comprime un File de imagen.
 * Si el archivo ya es chico y cabe en los límites, igual se re-encodea
 * (saca EXIF/metadatos y unifica formato) salvo que el resultado salga más pesado:
 * en ese caso se devuelve el original.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<{ blob: Blob; fileName: string; mimeType: string; width: number; height: number }> {
  const opts = { ...DEFAULTS, ...options };

  // HEIC/HEIF no siempre decodifican en canvas; dejamos que Cloudinary lo convierta.
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    return {
      blob: file,
      fileName: file.name,
      mimeType: file.type,
      width: 0,
      height: 0,
    };
  }

  const img = await loadImage(file);
  let { width, height } = img;

  const scale = Math.min(1, opts.maxWidth / width, opts.maxHeight / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(img, 0, 0, width, height);

  const supportsWebp =
    opts.preferWebp &&
    canvas.toDataURL('image/webp').startsWith('data:image/webp');
  const mimeType = supportsWebp ? 'image/webp' : 'image/jpeg';
  const ext = supportsWebp ? 'webp' : 'jpg';

  const blob = await canvasToBlob(canvas, mimeType, opts.quality);

  // Si la compresión no ayudó, devolvemos el original (salvo que haya redimensionado).
  if (blob.size >= file.size && scale === 1) {
    return {
      blob: file,
      fileName: file.name,
      mimeType: file.type || mimeType,
      width: img.naturalWidth || width,
      height: img.naturalHeight || height,
    };
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
  return {
    blob,
    fileName: `${base}.${ext}`,
    mimeType,
    width,
    height,
  };
}

/** Formato legible de bytes (ej. "340 KB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
