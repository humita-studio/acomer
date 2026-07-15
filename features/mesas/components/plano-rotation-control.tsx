'use client';

import { useEffect, useId, useState } from 'react';
import { cn } from '@/shared/lib/utils';

const ANGLE_PRESETS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * Control de rotación compartido por mesa y elemento: slider + grados tipeables
 * + presets de 45° en 45°. El handle sobre la figura sigue siendo el camino
 * más directo, esto cubre el caso "quiero un ángulo exacto sin arrastrar".
 */
export function RotationControl({
  value,
  onChange,
  hint,
}: {
  /** Grados normalizados 0–359. */
  value: number;
  onChange: (deg: number) => void;
  hint?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    onChange(((Math.round(n) % 360) + 360) % 360);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Rotación
        </label>
        <span className="flex items-center gap-0.5 text-xs font-semibold tabular-nums text-foreground">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            aria-label="Grados de rotación, de 0 a 359"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="w-9 rounded border border-transparent bg-transparent text-right focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          °
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={359}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
        aria-label="Ángulo de rotación"
      />
      <div role="group" aria-label="Ángulos comunes" className="mt-1.5 grid grid-cols-4 gap-1">
        {ANGLE_PRESETS.map((deg) => (
          <button
            key={deg}
            type="button"
            aria-pressed={value === deg}
            onClick={() => onChange(deg)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              value === deg
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {deg}°
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {hint ?? 'Arrastrá el handle ↻ sobre la figura · Shift alinea a 15°.'}
      </p>
    </div>
  );
}
