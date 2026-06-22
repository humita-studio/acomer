'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { DIAS, MESES, toYMD } from '../fechas';

type ConteoDia = { reservas: number; cubiertos: number };

/**
 * Calendario mensual con badges de reservas por día. El día seleccionado se
 * pinta con el color primario; "hoy" se resalta en acento.
 */
export function ReservasCalendar({
  mesKey,
  diaSel,
  hoy,
  porDia,
  maxReservasPorDia,
  onSelectDia,
  onCambiarMes,
}: {
  mesKey: string;
  diaSel: string;
  hoy: string;
  porDia: Map<string, ConteoDia>;
  maxReservasPorDia: number | null;
  onSelectDia: (ymd: string) => void;
  onCambiarMes: (delta: number) => void;
}) {
  const [y, m] = mesKey.split('-').map(Number);
  const tituloMes = `${MESES[m - 1]} ${y}`;

  // Grilla del mes (lunes primero), con celdas de relleno fuera del mes.
  const celdas = useMemo(() => {
    const primero = new Date(y, m - 1, 1);
    const offset = (primero.getDay() + 6) % 7; // Lun=0 … Dom=6
    const diasEnMes = new Date(y, m, 0).getDate();
    const out: { ymd: string; dia: number; inMonth: boolean }[] = [];
    for (let i = 0; i < offset; i++) out.push({ ymd: `x${i}`, dia: 0, inMonth: false });
    for (let d = 1; d <= diasEnMes; d++) {
      out.push({ ymd: toYMD(new Date(y, m - 1, d)), dia: d, inMonth: true });
    }
    while (out.length % 7 !== 0) out.push({ ymd: `x${out.length}`, dia: 0, inMonth: false });
    return out;
  }, [y, m]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => onCambiarMes(-1)} aria-label="Mes anterior">
          <ChevronLeft />
        </Button>
        <p className="flex-1 text-center text-[15px] font-semibold capitalize">{tituloMes}</p>
        <Button variant="ghost" size="icon-sm" onClick={() => onCambiarMes(1)} aria-label="Mes siguiente">
          <ChevronRight />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {DIAS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((c) => {
          if (!c.inMonth) return <div key={c.ymd} className="aspect-square" />;
          const info = porDia.get(c.ymd);
          const sel = c.ymd === diaSel;
          const esHoy = c.ymd === hoy;
          return (
            <button
              key={c.ymd}
              onClick={() => onSelectDia(c.ymd)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-sm transition-colors',
                sel
                  ? 'bg-primary text-primary-foreground'
                  : esHoy
                    ? 'bg-accent text-accent-foreground hover:bg-accent'
                    : 'text-foreground hover:bg-muted',
              )}
            >
              <span className={cn('font-medium', esHoy && !sel && 'font-semibold')}>{c.dia}</span>
              {info && info.reservas > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[9px] font-semibold leading-none',
                    sel ? 'bg-card text-primary' : 'bg-accent text-primary',
                  )}
                >
                  {maxReservasPorDia ? `${info.reservas}/${maxReservasPorDia}` : info.reservas}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
