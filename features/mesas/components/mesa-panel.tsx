'use client';

import { useEffect, useState } from 'react';
import { Circle, Copy, Square, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import { Stepper } from './plano-stepper';
import {
  COLS,
  FINE_STEP,
  ROWS,
  normalizeDeg,
  type AmbienteUI,
  type MesaPlano,
} from './plano-types';

const ANGLE_PRESETS = [0, 45, 90, 135, 180] as const;

/** Panel lateral de edición de una mesa (nombre, forma, capacidad, tamaño, ambiente). */
export function MesaPanel({
  mesa,
  ambientes,
  onUpdate,
  onRename,
  onDuplicate,
  onDelete,
}: {
  mesa: MesaPlano;
  ambientes: AmbienteUI[];
  onUpdate: (p: Partial<MesaPlano>) => void;
  onRename: (nombre: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [nombre, setNombre] = useState(mesa.identificador);

  useEffect(() => {
    setNombre(mesa.identificador);
  }, [mesa.id, mesa.identificador]);

  const commitNombre = () => {
    const limpio = nombre.trim();
    if (!limpio || limpio === mesa.identificador) {
      setNombre(mesa.identificador);
      return;
    }
    onRename(limpio);
  };

  const stepSize = (key: 'ancho' | 'alto', dir: 1 | -1) => {
    const cur = mesa[key];
    const next = Math.max(FINE_STEP, Math.min(key === 'ancho' ? COLS : ROWS, cur + dir * FINE_STEP));
    const snapped = Math.round(next * 2) / 2;
    onUpdate({ [key]: snapped });
  };

  const rot = normalizeDeg(mesa.rotacion);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Propiedades
        </p>
        <label className="mt-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Nombre
        </label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={commitNombre}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          maxLength={40}
          className="mt-1 font-display text-base font-semibold"
          aria-label="Nombre de la mesa"
        />
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
        min={1}
        max={20}
        onDec={() => onUpdate({ capacidad: Math.max(1, mesa.capacidad - 1) })}
        onInc={() => onUpdate({ capacidad: Math.min(20, mesa.capacidad + 1) })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Ancho"
          value={mesa.ancho}
          step={FINE_STEP}
          min={FINE_STEP}
          onDec={() => stepSize('ancho', -1)}
          onInc={() => stepSize('ancho', 1)}
        />
        <Stepper
          label="Alto"
          value={mesa.alto}
          step={FINE_STEP}
          min={FINE_STEP}
          onDec={() => stepSize('alto', -1)}
          onInc={() => stepSize('alto', 1)}
        />
      </div>

      {/* Rotación: slider libre + presets. El handle del canvas es el camino principal. */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rotación
          </label>
          <span className="text-xs font-semibold tabular-nums text-foreground">{rot}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={rot}
          onChange={(e) => onUpdate({ rotacion: Number(e.target.value) })}
          className="mt-2 w-full accent-primary"
          aria-label="Ángulo de rotación"
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {ANGLE_PRESETS.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => onUpdate({ rotacion: deg })}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums transition',
                rot === deg
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {deg}°
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          O arrastrá el handle ↻ sobre la mesa · Shift alinea a 15°.
        </p>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onDuplicate}>
        <Copy />
        Duplicar
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
