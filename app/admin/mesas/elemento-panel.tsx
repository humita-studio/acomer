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
      <h3 className="font-bold text-gray-800 capitalize">{elemento.tipo}</h3>

      {elemento.tipo === 'barra' && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Etiqueta</label>
          <input
            type="text"
            value={elemento.etiqueta ?? ''}
            onChange={(e) => onUpdate({ etiqueta: e.target.value })}
            placeholder="Ej: Barra"
            className="w-full mt-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
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
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm border border-gray-200 bg-white hover:bg-gray-100"
      >
        <RotateCw size={14} /> Rotar 90°
      </button>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
      >
        <Trash2 size={14} /> Eliminar elemento
      </button>
    </div>
  );
}
