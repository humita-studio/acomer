'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, UploadCloud } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

export function ImportarDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const elegirArchivo = (file: File | null) => {
    if (!file) return;
    setArchivo(file);
  };

  const handleImportar = () => {
    // Solo UI por ahora: el procesamiento del archivo llega en un paso posterior.
    toast('Importación en camino', {
      description: 'La carga masiva de productos estará disponible muy pronto.',
    });
    setArchivo(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>Cargá tu carta completa desde una planilla.</DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
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
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-accent/40"
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
              <p className="text-xs text-muted-foreground">CSV o XLSX · hasta 5 MB</p>
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleImportar} disabled={!archivo}>
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
