'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { QtyStepper } from './QtyStepper';

/** Sub-modal: cargar un ítem que no está en la carta (nombre + precio a mano). */
export function ItemLibreDialog({
  onClose,
  onAgregar,
}: {
  onClose: () => void;
  onAgregar: (nombre: string, precio: number, cantidad: number) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const precioNum = parseFloat(precio.replace(',', '.')) || 0;

  const confirmar = () => {
    const n = nombre.trim();
    if (!n) return setError('Poné un nombre');
    if (!(precioNum > 0)) return setError('El precio tiene que ser mayor a 0');
    onAgregar(n, precioNum, cantidad);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="block overflow-hidden p-0 sm:max-w-md">
        {/* Header */}
        <div className="space-y-0.5 border-b px-6 pt-5 pr-12 pb-4">
          <DialogTitle className="text-lg font-semibold">Ítem libre</DialogTitle>
          <DialogDescription>Algo que no está en la carta</DialogDescription>
        </div>

        {/* Cuerpo */}
        <div className="space-y-3.5 px-6 py-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Nombre
            </label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Torta de la abuela"
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Precio
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Cantidad
              </label>
              <QtyStepper
                value={cantidad}
                minusDisabled={cantidad <= 1}
                onMinus={() => setCantidad(Math.max(1, cantidad - 1))}
                onPlus={() => setCantidad(cantidad + 1)}
              />
            </div>
          </div>

          {/* Aviso: el ítem no se persiste en la carta */}
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5">
            <Info className="size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Se suma solo a esta venta. No se guarda en la carta.
            </p>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 border-t px-6 pt-4 pb-5">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Agregar al pedido</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
