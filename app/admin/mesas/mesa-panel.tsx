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
      <h3 className="font-bold text-gray-800">{mesa.identificador}</h3>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Forma</label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onUpdate({ forma: 'cuadrada' })}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm border ${
              mesa.forma !== 'redonda' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'
            }`}
          >
            <Square size={14} /> Cuadrada
          </button>
          <button
            onClick={() => onUpdate({ forma: 'redonda' })}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm border ${
              mesa.forma === 'redonda' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'
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
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm border border-gray-200 bg-white hover:bg-gray-100"
      >
        <RotateCw size={14} /> Rotar 90°
      </button>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Ambiente</label>
        <select
          value={mesa.ambienteId ?? ''}
          onChange={(e) => onUpdate({ ambienteId: e.target.value })}
          className="w-full mt-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
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
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
      >
        <Trash2 size={14} /> Eliminar mesa
      </button>
    </div>
  );
}
