'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { compressImage } from '@/shared/lib/compressImage';
import {
  eliminarImagenProductoAction,
  guardarImagenProductoAction,
  obtenerFirmaUploadProductoAction,
} from '../productoImagenActions';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;

/**
 * Campo compacto de foto de producto (solo en modo editar, con productoId).
 */
export function ProductoImagenField({
  productoId,
  imagenUrl: initialUrl,
  onChanged,
}: {
  productoId: string;
  imagenUrl?: string | null;
  onChanged?: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(initialUrl || '');
  const [prevUrl, setPrevUrl] = useState(initialUrl || '');
  if ((initialUrl || '') !== prevUrl) {
    setPrevUrl(initialUrl || '');
    setPreview(initialUrl || '');
  }
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Elegí una imagen JPG, PNG o WebP');
        return;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        toast.error('La imagen es demasiado grande (máx. 12 MB)');
        return;
      }

      setBusy(true);
      try {
        const compressed = await compressImage(file, { maxWidth: 1200 });
        const firma = await obtenerFirmaUploadProductoAction(productoId);
        if (!firma.success) {
          toast.error(firma.message);
          return;
        }

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

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`,
          { method: 'POST', body: form },
        );
        if (!res.ok) {
          toast.error('Falló la subida a Cloudinary');
          return;
        }
        const json = (await res.json()) as {
          public_id?: string;
          version?: number;
        };
        if (!json.public_id) {
          toast.error('Respuesta inválida de Cloudinary');
          return;
        }

        const saved = await guardarImagenProductoAction({
          productoId,
          publicId: json.public_id,
          version: json.version,
        });
        if (!saved.success) {
          toast.error(saved.message);
          return;
        }
        setPreview(saved.imagenUrl);
        onChanged?.(saved.imagenUrl);
        toast.success('Foto guardada');
      } catch (e) {
        console.error(e);
        toast.error('No se pudo subir la imagen');
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onChanged, productoId],
  );

  const remove = async () => {
    setBusy(true);
    try {
      const res = await eliminarImagenProductoAction(productoId);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      setPreview('');
      onChanged?.(null);
      toast.success('Foto eliminada');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Foto del plato</Label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:bg-muted"
        >
          {preview ? (
            <Image src={preview} alt="" fill className="object-cover" sizes="80px" unoptimized />
          ) : (
            <ImagePlus className="size-6" aria-hidden />
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-5 animate-spin" />
            </span>
          ) : null}
        </button>
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {preview ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={remove}
              className="justify-start text-destructive"
            >
              <Trash2 className="size-3.5" />
              Quitar
            </Button>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            JPG/PNG/WebP. Se optimiza al subir. Guardá el producto primero si es nuevo.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
    </div>
  );
}
