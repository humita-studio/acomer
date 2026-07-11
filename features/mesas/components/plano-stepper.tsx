'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

/** Control numérico +/- usado por los paneles de edición de mesa y elemento. */
export function Stepper({
  label,
  value,
  onDec,
  onInc,
  className,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-sm" onClick={onDec} aria-label={`Disminuir ${label}`}>
          <Minus />
        </Button>
        <span className="min-w-8 flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <Button type="button" variant="outline" size="icon-sm" onClick={onInc} aria-label={`Aumentar ${label}`}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}
