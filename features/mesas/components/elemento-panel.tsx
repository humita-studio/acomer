'use client';

import { RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Stepper } from './plano-stepper';
import { type ElementoPlanoUI } from './plano-types';

/** Panel lateral de edición de un elemento del plano (pared/barra). */
export function ElementoPanel({
  elemento,
  onUpdate,
  onDelete,
}: {
  elemento: ElementoPlanoUI;
  onUpdate: (p: Partial<ElementoPlanoUI>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Propiedades
        </p>
        <h3 className="font-display text-lg font-semibold capitalize tracking-tight text-foreground">
          {elemento.tipo}
        </h3>
      </div>

      {elemento.tipo === 'barra' && (
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Etiqueta
          </label>
          <Input
            type="text"
            value={elemento.etiqueta ?? ''}
            onChange={(e) => onUpdate({ etiqueta: e.target.value })}
            placeholder="Ej: Barra"
            className="mt-1.5"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Ancho"
          value={elemento.ancho}
          onDec={() => onUpdate({ ancho: Math.max(1, elemento.ancho - 1) })}
          onInc={() => onUpdate({ ancho: elemento.ancho + 1 })}
        />
        <Stepper
          label="Alto"
          value={elemento.alto}
          onDec={() => onUpdate({ alto: Math.max(1, elemento.alto - 1) })}
          onInc={() => onUpdate({ alto: elemento.alto + 1 })}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onUpdate({ rotacion: (elemento.rotacion + 90) % 360 })}
      >
        <RotateCw />
        Rotar 90°
      </Button>

      <Button type="button" variant="destructive" className="w-full" onClick={onDelete}>
        <Trash2 />
        Eliminar elemento
      </Button>
    </div>
  );
}
