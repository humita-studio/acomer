'use client';

import { Circle, RotateCw, Square, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
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
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Propiedades
        </p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
          {mesa.identificador}
        </h3>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Forma
        </label>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ forma: 'cuadrada' })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md border py-2 text-sm font-medium transition',
              mesa.forma !== 'redonda'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-secondary-foreground hover:bg-muted',
            )}
          >
            <Square size={14} /> Cuadrada
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ forma: 'redonda' })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md border py-2 text-sm font-medium transition',
              mesa.forma === 'redonda'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-secondary-foreground hover:bg-muted',
            )}
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

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onUpdate({ rotacion: (mesa.rotacion + 90) % 360 })}
      >
        <RotateCw />
        Rotar 90°
      </Button>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ambiente
        </label>
        <select
          value={mesa.ambienteId ?? ''}
          onChange={(e) => onUpdate({ ambienteId: e.target.value })}
          className="mt-1.5 w-full rounded-md border border-border bg-card px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          {ambientes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      <Button type="button" variant="destructive" className="w-full" onClick={onDelete}>
        <Trash2 />
        Eliminar mesa
      </Button>
    </div>
  );
}
