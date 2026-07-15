'use client';

import { useEffect, useState } from 'react';
import { Circle, Copy, Square, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import { Stepper } from './plano-stepper';
import { RotationControl } from './plano-rotation-control';
import {
  COLS,
  FINE_STEP,
  ROWS,
  normalizeDeg,
  round2,
  type AmbienteUI,
  type MesaPlano,
} from './plano-types';

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

      <div role="group" aria-label="Forma de la mesa">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Forma
        </span>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            aria-pressed={mesa.forma !== 'redonda'}
            onClick={() => onUpdate({ forma: 'cuadrada' })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md border py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              mesa.forma !== 'redonda'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-secondary-foreground hover:bg-muted',
            )}
          >
            <Square size={14} /> Cuadrada
          </button>
          <button
            type="button"
            aria-pressed={mesa.forma === 'redonda'}
            onClick={() => onUpdate({ forma: 'redonda' })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md border py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
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
        onChange={(v) => onUpdate({ capacidad: Math.round(v) })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Ancho"
          value={mesa.ancho}
          step={FINE_STEP}
          min={FINE_STEP}
          max={COLS}
          onDec={() => stepSize('ancho', -1)}
          onInc={() => stepSize('ancho', 1)}
          onChange={(v) => onUpdate({ ancho: round2(v) })}
        />
        <Stepper
          label="Alto"
          value={mesa.alto}
          step={FINE_STEP}
          min={FINE_STEP}
          max={ROWS}
          onDec={() => stepSize('alto', -1)}
          onInc={() => stepSize('alto', 1)}
          onChange={(v) => onUpdate({ alto: round2(v) })}
        />
      </div>

      <RotationControl
        value={rot}
        onChange={(deg) => onUpdate({ rotacion: deg })}
        hint="Arrastrá el handle ↻ sobre la mesa · Shift alinea a 15°."
      />

      <Button type="button" variant="outline" className="w-full" onClick={onDuplicate}>
        <Copy />
        Duplicar
      </Button>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ambiente
        </label>
        <Select
          value={mesa.ambienteId ?? ''}
          onValueChange={(v) => onUpdate({ ambienteId: v })}
        >
          <SelectTrigger className="mt-1.5 w-full" aria-label="Ambiente de la mesa">
            <SelectValue placeholder="Elegí un ambiente" />
          </SelectTrigger>
          <SelectContent>
            {ambientes.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="button" variant="destructive" className="w-full" onClick={onDelete}>
        <Trash2 />
        Eliminar mesa
      </Button>
    </div>
  );
}
