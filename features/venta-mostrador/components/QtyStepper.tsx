'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/** Stepper de cantidad (caja con borde — estilo del Figma) usado en todo el flujo. */
export function QtyStepper({
  value,
  onMinus,
  onPlus,
  minusDisabled = false,
  size = 'md',
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const cell = size === 'sm' ? 'size-7' : 'size-9';
  const num = size === 'sm' ? 'w-7 text-xs' : 'w-9 text-sm';
  const icon = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <div className="flex items-center rounded-md border border-border-strong">
      <button
        type="button"
        onClick={onMinus}
        disabled={minusDisabled}
        className={cn(
          'flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground',
          cell,
        )}
        aria-label="Restar"
      >
        <Minus className={icon} />
      </button>
      <span className={cn('text-center font-semibold tabular-nums', num)}>{value}</span>
      <button
        type="button"
        onClick={onPlus}
        className={cn(
          'flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground',
          cell,
        )}
        aria-label="Sumar"
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
