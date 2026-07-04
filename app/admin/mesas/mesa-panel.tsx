'use client';

import { Circle, RotateCw, Square, Trash2 } from 'lucide-react';
import { Stepper } from './plano-stepper';
import { type AmbienteUI, type MesaPlano } from './plano-types';

/** Panel lateral de edición de una mesa (forma, capacidad, tamaño, ambiente). */
export function MesaPanel({
  mesa,
  ambientes,
  onUpdate,
  onDelete,
}: {
  mesa: MesaPlano;
  ambientes: AmbienteUI[];
  onUpdate: (p: Partial<MesaPlano>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground">{mesa.identificador}</h3>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">Forma</label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onUpdate({ forma: 'cuadrada' })}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm border ${
              mesa.forma !== 'redonda' ? 'bg-primary text-white border-primary' : 'bg-card border-border'
            }`}
          >
            <Square size={14} /> Cuadrada
          </button>
          <button
            onClick={() => onUpdate({ forma: 'redonda' })}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm border ${
              mesa.forma === 'redonda' ? 'bg-primary text-white border-primary' : 'bg-card border-border'
            }`}
          >
            <Circle size={14} /> Redonda
          </button>
        </div>
      </div>

      <Stepper
        label="Capacidad (sillas)"
        value={mesa.capacidad}
        onDec={() => onUpdate({ capacidad: Math.max(1, mesa.capacidad - 1) })}
        onInc={() => onUpdate({ capacidad: mesa.capacidad + 1 })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Ancho"
          value={mesa.ancho}
          onDec={() => onUpdate({ ancho: Math.max(1, mesa.ancho - 1) })}
          onInc={() => onUpdate({ ancho: mesa.ancho + 1 })}
        />
        <Stepper
          label="Alto"
          value={mesa.alto}
          onDec={() => onUpdate({ alto: Math.max(1, mesa.alto - 1) })}
          onInc={() => onUpdate({ alto: mesa.alto + 1 })}
        />
      </div>

      <button
        onClick={() => onUpdate({ rotacion: (mesa.rotacion + 90) % 360 })}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm border border-border bg-card hover:bg-muted"
      >
        <RotateCw size={14} /> Rotar 90°
      </button>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">Ambiente</label>
        <select
          value={mesa.ambienteId ?? ''}
          onChange={(e) => onUpdate({ ambienteId: e.target.value })}
          className="w-full mt-1 px-2 py-1.5 border border-border rounded-md text-sm bg-card"
        >
          {ambientes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium text-destructive border border-destructive/40 bg-destructive-subtle hover:bg-destructive-subtle"
      >
        <Trash2 size={14} /> Eliminar mesa
      </button>
    </div>
  );
}
