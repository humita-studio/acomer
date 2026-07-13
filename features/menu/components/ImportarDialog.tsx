'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Loader2, UploadCloud } from 'lucide-react';
import { parseMenuCsv } from '@/features/menu/importarCsv';
import { importarMenuFilasAction } from '@/features/menu/importarMenuActions';
import { queryKeys } from '@/shared/query/keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

const MAX_BYTES = 5 * 1024 * 1024;

export function ImportarDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const elegirArchivo = (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      toast.error('Por ahora solo CSV. Descargá la plantilla de ejemplo.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('El archivo pesa más de 5 MB.');
      return;
    }
    setArchivo(file);
  };

  const handleImportar = async () => {
    if (!archivo || pending) return;
    setPending(true);
    try {
      const text = await archivo.text();
      const parsed = parseMenuCsv(text);
      if (!parsed.ok) {
        toast.error(parsed.message, {
          description: parsed.errores?.slice(0, 3).join(' · '),
        });
        return;
      }

      const res = await importarMenuFilasAction(parsed.filas);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.productosMenu() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categoriasMenu() }),
      ]);
      reset();
      onOpenChange(false);
    } catch {
      toast.error('No se pudo leer el archivo. Probá de nuevo.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Cargá tu carta desde un CSV con la plantilla. Se crean categorías nuevas si no
            existen.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            elegirArchivo(e.dataTransfer.files?.[0] ?? null);
          }}
          disabled={pending}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-accent/40 disabled:opacity-60"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-card text-primary shadow-sm">
            <UploadCloud className="size-5" />
          </span>
          {archivo ? (
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{archivo.name}</p>
              <p className="text-xs text-muted-foreground">Hacé clic para elegir otro archivo</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                Arrastrá tu archivo o hacé clic para subir
              </p>
              <p className="text-xs text-muted-foreground">CSV · hasta 5 MB · máx. 300 productos</p>
            </div>
          )}
        </button>

        <a
          href="/plantillas/menu-ejemplo.csv"
          download
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <FileText className="size-4" />
          Descargar plantilla de ejemplo
        </a>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleImportar()} disabled={!archivo || pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importando…
              </>
            ) : (
              'Importar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
