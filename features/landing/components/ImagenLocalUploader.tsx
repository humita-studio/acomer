'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Progress } from '@/shared/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import { compressImage, formatBytes } from '@/shared/lib/compressImage';
import {
  eliminarImagenLocalAction,
  guardarImagenLocalAction,
  obtenerFirmaUploadImagenAction,
  type ImagenLocalKind,
} from '../imagenLocalActions';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024; // 12 MB antes de comprimir

const COPY: Record<
  ImagenLocalKind,
  { title: string; description: string; alt: string; aspect: string; hint: string; compressMax: number }
> = {
  cover: {
    title: 'Foto del local',
    description:
      'Portada de tu página pública. Arrastrá una imagen o hacé click. Se optimiza automáticamente (WebP/AVIF) para que pese poco.',
    alt: 'Portada del local',
    aspect: 'aspect-[16/10]',
    hint: 'JPG, PNG o WebP. Recomendado horizontal (16:10). Se redimensiona a máx. 1600 px y se comprime antes de subir. Al quitar, se borra también en Cloudinary.',
    compressMax: 1600,
  },
  logo: {
    title: 'Logo',
    description:
      'Logo del local (cuadrado). Aparece en el hero de la landing. Fondo transparente o blanco funciona bien.',
    alt: 'Logo del local',
    aspect: 'aspect-square max-w-[200px]',
    hint: 'JPG, PNG o WebP. Preferible cuadrado. Se recorta a 400×400. Al quitar, se borra también en Cloudinary.',
    compressMax: 800,
  },
};

type Props = {
  imagenUrl: string;
  /** Portada del hero o logo. Default: cover. */
  kind?: ImagenLocalKind;
  onChanged?: (next: { imagenUrl: string; imagenPublicId: string }) => void;
};

/**
 * Sube portada o logo del local a Cloudinary con compresión previa en el browser.
 * Soporta click y drag-and-drop.
 * Flujo: comprimir → firma server → upload directo a Cloudinary → persistir public_id.
 */
export function ImagenLocalUploader({
  imagenUrl: initialUrl,
  kind = 'cover',
  onChanged,
}: Props) {
  const meta = COPY[kind];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [preview, setPreview] = useState(initialUrl || '');
  // Sincronizar preview cuando el server manda una URL nueva (p. ej. tras guardar).
  // Ajuste de state durante render (patrón recomendado por React) evita setState en effect.
  const [prevInitialUrl, setPrevInitialUrl] = useState(initialUrl);
  if (initialUrl !== prevInitialUrl) {
    setPrevInitialUrl(initialUrl);
    setPreview(initialUrl || '');
  }
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Elegí un archivo de imagen (JPG, PNG o WebP)');
        return;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        toast.error('La imagen es muy pesada (máx. 12 MB). Probá con otra más chica.');
        return;
      }

      setUploading(true);
      setProgress(5);
      setStatusText('Optimizando imagen…');
      setIsDragging(false);
      dragDepth.current = 0;

      try {
        // 1) Comprimir en el cliente (menos bytes por la red y en Cloudinary).
        const compressed = await compressImage(file, {
          maxWidth: meta.compressMax,
          maxHeight: meta.compressMax,
          quality: 0.82,
          preferWebp: true,
        });
        setProgress(25);
        setStatusText(
          `Subiendo (${formatBytes(file.size)} → ${formatBytes(compressed.blob.size)})…`,
        );

        // 2) Firma de Cloudinary (API secret solo en el server).
        const firma = await obtenerFirmaUploadImagenAction(kind);
        if (!firma.success) {
          throw new Error(firma.message ?? 'No se pudo firmar la subida');
        }
        setProgress(40);

        // 3) Upload directo a Cloudinary (XHR para progreso real).
        const form = new FormData();
        form.append('file', compressed.blob, compressed.fileName);
        form.append('api_key', firma.apiKey);
        form.append('timestamp', String(firma.timestamp));
        form.append('signature', firma.signature);
        form.append('folder', firma.folder);
        form.append('public_id', firma.publicId);
        form.append('transformation', firma.transformation);
        form.append('overwrite', firma.overwrite);
        form.append('invalidate', firma.invalidate);

        const uploadUrl = `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`;
        const result = await uploadWithProgress(uploadUrl, form, (p) => {
          // Mapear 0–100 del XHR a 40–85 de la barra total.
          setProgress(40 + Math.round(p * 0.45));
        });

        if (!result.public_id) {
          const errMsg =
            result.error && typeof result.error === 'object' && 'message' in result.error
              ? String((result.error as { message?: string }).message)
              : null;
          throw new Error(errMsg || 'Cloudinary no devolvió public_id');
        }
        setProgress(90);
        setStatusText('Guardando…');

        // 4) Persistir en nuestra DB (con version de Cloudinary para romper caché).
        const saved = await guardarImagenLocalAction({
          publicId: result.public_id as string,
          kind,
          version: result.version as number | string | undefined,
          secureUrl: result.secure_url as string | undefined,
        });
        if (!saved.success) {
          throw new Error(saved.message ?? 'No se pudo guardar');
        }

        setPreview(saved.imagenUrl);
        onChanged?.({
          imagenUrl: saved.imagenUrl,
          imagenPublicId: saved.imagenPublicId,
        });
        setProgress(100);
        toast.success(kind === 'logo' ? 'Logo actualizado' : 'Imagen actualizada');
        router.refresh();
      } catch (e) {
        console.error('[ImagenLocalUploader]', e);
        toast.error(e instanceof Error ? e.message : 'No se pudo subir la imagen');
      } finally {
        setUploading(false);
        setProgress(0);
        setStatusText('');
        resetInput();
      }
    },
    [onChanged, router, kind, meta.compressMax],
  );

  const pickFromDataTransfer = (dt: DataTransfer | null): File | null => {
    if (!dt) return null;
    if (dt.files?.length) {
      const f = dt.files[0];
      if (f?.type.startsWith('image/')) return f;
    }
    // Algunos browsers solo ponen items (p. ej. arrastre desde apps).
    if (dt.items?.length) {
      for (const item of Array.from(dt.items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          return item.getAsFile();
        }
      }
    }
    return null;
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    // Necesario para habilitar drop en el browser.
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (uploading) return;

    const file = pickFromDataTransfer(e.dataTransfer);
    if (!file) {
      toast.error('Soltá un archivo de imagen (JPG, PNG o WebP)');
      return;
    }
    void handleFile(file);
  };

  const handleRemove = async () => {
    if (!preview || uploading) return;
    setUploading(true);
    setStatusText('Eliminando de Cloudinary…');
    try {
      const res = await eliminarImagenLocalAction(kind);
      if (!res.success) throw new Error(res.message ?? 'No se pudo eliminar');
      setPreview('');
      onChanged?.({ imagenUrl: '', imagenPublicId: '' });
      toast.success(
        res.deletedFromCloudinary
          ? kind === 'logo'
            ? 'Logo eliminado de Cloudinary'
            : 'Imagen eliminada de Cloudinary'
          : kind === 'logo'
            ? 'Logo quitado'
            : 'Imagen quitada',
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setUploading(false);
      setStatusText('');
    }
  };

  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{meta.title}</CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-label={preview ? `Cambiar ${meta.alt.toLowerCase()}` : `Subir ${meta.alt.toLowerCase()}`}
          aria-disabled={uploading}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={cn(
            'relative w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed bg-muted transition-colors outline-none',
            meta.aspect,
            kind === 'logo' && 'rounded-full',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isDragging && 'border-primary bg-primary/5 ring-2 ring-primary/30',
            !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/40',
            uploading && 'pointer-events-none cursor-default',
          )}
        >
          {preview ? (
            <Image
              // key fuerza remount cuando cambia la URL versionada (evita flash de la vieja).
              key={preview}
              src={preview}
              alt={meta.alt}
              fill
              className="object-cover"
              sizes={kind === 'logo' ? '200px' : '(max-width: 768px) 100vw, 480px'}
              unoptimized
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <Upload className="size-8 opacity-50" aria-hidden />
              <p className="text-sm font-medium">
                {kind === 'logo' ? 'Arrastrá el logo acá' : 'Arrastrá una foto acá'}
              </p>
              <p className="text-xs">o hacé click para elegir un archivo</p>
            </div>
          )}

          {/* Overlay al arrastrar (también si ya hay preview) */}
          {isDragging && !uploading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-primary/15 backdrop-blur-[1px]">
              <ImagePlus className="size-8 text-primary" aria-hidden />
              <p className="text-sm font-medium text-primary">Soltá para subir</p>
            </div>
          ) : null}

          {uploading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/70 px-8 backdrop-blur-[2px]">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              <Progress value={progress} className="h-2 w-full max-w-xs" />
              <p className="text-xs text-muted-foreground">{statusText || 'Procesando…'}</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          id="imagen-local-input"
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={uploading} onClick={openPicker}>
            <ImagePlus className="mr-2 size-4" />
            {preview
              ? kind === 'logo'
                ? 'Cambiar logo'
                : 'Cambiar foto'
              : kind === 'logo'
                ? 'Subir logo'
                : 'Subir foto'}
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                void handleRemove();
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Quitar
            </Button>
          ) : null}
        </div>

        <Label className="text-xs font-normal text-muted-foreground">{meta.hint}</Label>
      </CardContent>
    </Card>
  );
}

/** XHR upload con callback de progreso 0–100. */
function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        reject(new Error('Respuesta inválida de Cloudinary'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else {
        const err = body.error as { message?: string } | undefined;
        reject(new Error(err?.message || `Error de subida (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red al subir la imagen'));
    xhr.send(form);
  });
}
