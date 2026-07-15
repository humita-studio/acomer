'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Stepper } from './plano-stepper';
import { RotationControl } from './plano-rotation-control';
import { COLS, FINE_STEP, ROWS, normalizeDeg, round2, type ElementoPlanoUI } from './plano-types';

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
  const esParedFina = elemento.tipo === 'pared' && elemento.alto <= 0.5;

  const stepSize = (key: 'ancho' | 'alto', dir: 1 | -1) => {
    const cur = elemento[key];
    const max = key === 'ancho' ? COLS : ROWS;
    const min = esParedFina && key === 'alto' ? 0.15 : 0.2;
    const next = Math.max(min, Math.min(max, cur + dir * FINE_STEP));
    const snapped = Math.round(next * 2) / 2;
    onUpdate({ [key]: Math.max(min, snapped) });
  };

  const rot = normalizeDeg(elemento.rotacion);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Propiedades
        </p>
        <h3 className="font-display text-lg font-semibold capitalize tracking-tight text-foreground">
          {elemento.tipo === 'pared' ? 'Pared' : elemento.tipo}
        </h3>
      </div>

      {(elemento.tipo === 'barra' || elemento.etiqueta) && (
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
          label={esParedFina ? 'Largo' : 'Ancho'}
          value={elemento.ancho}
          step={FINE_STEP}
          min={0.2}
          max={COLS}
          onDec={() => stepSize('ancho', -1)}
          onInc={() => stepSize('ancho', 1)}
          onChange={(v) => onUpdate({ ancho: round2(v) })}
        />
        {!esParedFina && (
          <Stepper
            label="Alto"
            value={elemento.alto}
            step={FINE_STEP}
            min={0.2}
            max={ROWS}
            onDec={() => stepSize('alto', -1)}
            onInc={() => stepSize('alto', 1)}
            onChange={(v) => onUpdate({ alto: round2(v) })}
          />
        )}
      </div>

      <RotationControl
        value={rot}
        onChange={(deg) => onUpdate({ rotacion: deg })}
        hint="Arrastrá el handle ↻ sobre el elemento · Shift alinea a 15°."
      />

      <Button type="button" variant="destructive" className="w-full" onClick={onDelete}>
        <Trash2 />
        Eliminar
      </Button>
    </div>
  );
}
