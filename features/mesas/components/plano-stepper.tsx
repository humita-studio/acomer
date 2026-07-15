'use client';

import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { round2 } from './plano-types';

/**
 * Control numérico +/- usado por los paneles de edición de mesa y elemento.
 * El valor también se puede tipear a mano (más rápido que clickear +/- varias veces).
 */
export function Stepper({
  label,
  value,
  onDec,
  onInc,
  onChange,
  step = 1,
  min,
  max,
  className,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  /** Commit de un valor tipeado a mano (el caller decide si redondea/clampa). */
  onChange?: (value: number) => void;
  /** Paso del contador (default 1). Para tamaños del plano conviene 0.5. */
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const id = useId();
  const canDec = min === undefined || value - step >= min - 1e-9;
  const canInc = max === undefined || value + step <= max + 1e-9;
  // Enteros sin decimales; medios (2.5) con un decimal.
  const display =
    Math.abs(value - Math.round(value)) < 1e-9 ? String(Math.round(value)) : String(round2(value));
  const [draft, setDraft] = useState(display);

  useEffect(() => setDraft(display), [display]);

  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (!Number.isFinite(n)) {
      setDraft(display);
      return;
    }
    let clamped = n;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange?.(clamped);
  };

  return (
    <div className={cn(className)}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onDec}
          disabled={!canDec}
          aria-label={`Disminuir ${label}`}
        >
          <Minus />
        </Button>
        {onChange ? (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            role="spinbutton"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="min-w-8 flex-1 rounded-md border border-transparent bg-transparent text-center text-sm font-semibold tabular-nums text-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        ) : (
          <span
            id={id}
            className="min-w-8 flex-1 text-center text-sm font-semibold tabular-nums text-foreground"
          >
            {display}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onInc}
          disabled={!canInc}
          aria-label={`Aumentar ${label}`}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
