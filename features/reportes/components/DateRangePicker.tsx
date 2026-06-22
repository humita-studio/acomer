'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  PRESETS,
  type Preset,
  cantidadDias,
  ddmmaaaa,
  detectarPreset,
  parseYmd,
  rangoPreset,
  ymd,
} from '@/features/reportes/dateRange';

/**
 * Selector de rango de fechas: dispara un popover con presets a la izquierda y
 * un calendario de rango a la derecha. El rango se elige en borrador y recién
 * se confirma con "Aplicar" (evita disparar consultas a mitad de selección).
 */
export function DateRangePicker({
  desde,
  hasta,
  hoy,
  onApply,
}: {
  desde: string;
  hasta: string;
  hoy: string;
  onApply: (desde: string, hasta: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: parseYmd(desde),
    to: parseYmd(hasta),
  });

  // Al abrir, resincroniza el borrador con el rango aplicado afuera (p. ej. los
  // presets del encabezado). No se toca con el popover cerrado.
  function cambiarOpen(next: boolean) {
    if (next) setDraft({ from: parseYmd(desde), to: parseYmd(hasta) });
    setOpen(next);
  }

  const draftDesde = draft?.from ? ymd(draft.from) : undefined;
  const draftHasta = draft?.to ? ymd(draft.to) : draftDesde;
  const presetActivo = draftDesde && draftHasta ? detectarPreset(draftDesde, draftHasta, hoy) : '';

  function elegirPreset(p: Preset) {
    const r = rangoPreset(p, hoy);
    setDraft({ from: parseYmd(r.desde), to: parseYmd(r.hasta) });
  }

  function aplicar() {
    if (draftDesde && draftHasta) {
      onApply(draftDesde, draftHasta);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={cambiarOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Elegir rango de fechas"
          className="group/range flex items-center gap-2.5"
        >
          <Pildora>{ddmmaaaa(desde)}</Pildora>
          <span className="text-sm text-muted-foreground">—</span>
          <Pildora>{ddmmaaaa(hasta)}</Pildora>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto flex-row gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="flex w-40 flex-col gap-1 border-r border-border p-3">
          <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">
            Rangos
          </p>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => elegirPreset(p.value)}
              className={cn(
                'rounded-md px-2 py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                presetActivo === p.value && 'bg-accent text-accent-foreground hover:bg-accent',
              )}
            >
              {p.largo}
            </button>
          ))}
        </div>

        <div className="flex flex-col">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={1}
            locale={es}
            defaultMonth={draft?.from ?? parseYmd(hasta)}
            disabled={{ after: parseYmd(hoy) }}
            className="p-3"
          />
          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground tabular-nums">
              {draftDesde && draftHasta
                ? `${cantidadDias(draftDesde, draftHasta)} ${cantidadDias(draftDesde, draftHasta) === 1 ? 'día' : 'días'}`
                : 'Elegí un rango'}
            </p>
            <Button size="sm" onClick={aplicar} disabled={!draftDesde || !draftHasta}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Pildora({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 items-center gap-2 rounded-md border border-border-strong bg-card pr-3.5 pl-3 text-sm font-medium text-foreground transition-colors group-hover/range:bg-muted/50">
      <CalendarDays className="size-4 text-muted-foreground" />
      <span className="tabular-nums">{children}</span>
    </span>
  );
}
