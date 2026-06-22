'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { formatPeso } from '@/shared/lib/format';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import type { ProductoMenu } from '@/features/carta/types';
import { QtyStepper } from './QtyStepper';

/** Sub-modal: elegir variante (si tiene) + adicionales + cantidad antes de sumarlo. */
export function ProductoConfigDialog({
  producto,
  onClose,
  onAgregar,
}: {
  producto: ProductoMenu;
  onClose: () => void;
  onAgregar: (modIds: string[], cantidad: number, varianteId: string | null) => void;
}) {
  const tieneVariantes = producto.variantes.length > 0;
  const [varianteId, setVarianteId] = useState<string | null>(
    tieneVariantes ? (producto.variantes.find((v) => v.esDefault) ?? producto.variantes[0]).id : null,
  );
  const variante = tieneVariantes
    ? producto.variantes.find((v) => v.id === varianteId) ?? null
    : null;

  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);

  const toggle = (id: string) =>
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const extra = producto.modificadores
    .filter((m) => seleccion.includes(m.id))
    .reduce((s, m) => s + m.precioExtra, 0);
  const precioBase = variante ? variante.precio : producto.precio;
  const unitario = precioBase + extra;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <div className="space-y-1">
          <DialogTitle>{producto.nombre}</DialogTitle>
          <DialogDescription>
            {tieneVariantes
              ? 'Elegí una opción y los adicionales'
              : `Precio base ${formatPeso(producto.precio)} · elegí los adicionales`}
          </DialogDescription>
        </div>

        {/* Variantes: elección única (precio fijo) */}
        {tieneVariantes && (
          <div className="space-y-2">
            {producto.variantes.map((v) => {
              const activo = varianteId === v.id;
              return (
                <label
                  key={v.id}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-colors',
                    activo ? 'border-primary bg-primary/5' : 'hover:bg-muted',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="variante-mostrador"
                      checked={activo}
                      onChange={() => setVarianteId(v.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm font-medium">{v.nombre}</span>
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatPeso(v.precio)}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {producto.modificadores.length > 0 && (
          <div className="space-y-2">
            {producto.modificadores.map((m) => {
              const activo = seleccion.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-colors',
                    activo ? 'border-primary bg-primary/5' : 'hover:bg-muted',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => toggle(m.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm font-medium">{m.nombre}</span>
                  </span>
                  {m.precioExtra > 0 && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      +{formatPeso(m.precioExtra)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <QtyStepper
            value={cantidad}
            minusDisabled={cantidad <= 1}
            onMinus={() => setCantidad(Math.max(1, cantidad - 1))}
            onPlus={() => setCantidad(cantidad + 1)}
          />
          <Button onClick={() => onAgregar(seleccion, cantidad, variante?.id ?? null)}>
            Agregar · {formatPeso(unitario * cantidad)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
