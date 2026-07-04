'use client';

import { RotateCw, Trash2 } from 'lucide-react';
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
    <div className="space-y-3">
      <h3 className="font-bold text-foreground capitalize">{elemento.tipo}</h3>

      {elemento.tipo === 'barra' && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Etiqueta</label>
          <input
            type="text"
            value={elemento.etiqueta ?? ''}
            onChange={(e) => onUpdate({ etiqueta: e.target.value })}
            placeholder="Ej: Barra"
            className="w-full mt-1 px-2 py-1.5 border border-border rounded-md text-sm bg-card"
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

      <button
        onClick={() => onUpdate({ rotacion: (elemento.rotacion + 90) % 360 })}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm border border-border bg-card hover:bg-muted"
      >
        <RotateCw size={14} /> Rotar 90°
      </button>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium text-destructive border border-destructive/40 bg-destructive-subtle hover:bg-destructive-subtle"
      >
        <Trash2 size={14} /> Eliminar elemento
      </button>
    </div>
  );
}
