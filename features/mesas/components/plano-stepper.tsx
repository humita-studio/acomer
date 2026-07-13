'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { round2 } from './plano-types';

/** Control numérico +/- usado por los paneles de edición de mesa y elemento. */
export function Stepper({
  label,
  value,
  onDec,
  onInc,
  step = 1,
  min,
  max,
  className,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  /** Paso del contador (default 1). Para tamaños del plano conviene 0.5. */
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const canDec = min === undefined || value - step >= min - 1e-9;
  const canInc = max === undefined || value + step <= max + 1e-9;
  // Enteros sin decimales; medios (2.5) con un decimal.
  const display =
    Math.abs(value - Math.round(value)) < 1e-9 ? String(Math.round(value)) : String(round2(value));

  return (
    <div className={cn(className)}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
        <span className="min-w-8 flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
          {display}
        </span>
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
