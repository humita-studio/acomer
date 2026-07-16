'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  COLS,
  GRID_PX,
  MIN_CELL,
  ROWS,
  type ElementoPlanoUI,
  type MesaPlano,
} from '@/features/mesas/components/plano-types';

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export type MesaEstadoAsignacion = 'libre' | 'chica' | 'ocupada' | 'actual';

/**
 * Plano de solo lectura para elegir mesa de una reserva. Colores:
 * - libre (verde): capacidad ok y sin conflicto
 * - chica (ámbar): libre pero no entra el grupo
 * - ocupada (gris): otra reserva en ese horario
 * - actual (primary): mesa ya asignada a esta reserva
 */
export function PlanoAsignacion({
  mesas,
  elementos,
  estadoPorMesa,
  onElegir,
  disabled,
}: {
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
  estadoPorMesa: Record<string, MesaEstadoAsignacion>;
  onElegir: (mesaId: string) => void;
  disabled?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(GRID_PX);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const c = clamp(Math.floor(el.clientWidth / COLS), MIN_CELL, GRID_PX);
      setCell(c);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = COLS * cell;
  const height = ROWS * cell;

  const mesasSorted = useMemo(
    () => [...mesas].sort((a, b) => a.identificador.localeCompare(b.identificador, undefined, { numeric: true })),
    [mesas],
  );

  return (
    <div ref={wrapperRef} className="w-full overflow-auto rounded-xl border bg-muted/30">
      <div className="relative mx-auto" style={{ width, height, minHeight: 200 }}>
        {/* Puntos de grilla suaves */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px)`,
            backgroundSize: `${cell}px ${cell}px`,
          }}
        />

        {elementos.map((el) => {
          const esParedFina = el.tipo === 'pared' && el.alto <= 0.5;
          let estilo =
            'bg-[#3d3a36]/90 border border-[#2a2825] rounded-md opacity-70';
          if (el.tipo === 'barra') {
            estilo =
              'bg-gradient-to-b from-[#9a7b55] to-[#7a5f40] border border-[#5c4630]/80 rounded-md opacity-80';
          } else if (el.tipo === 'contorno') {
            estilo = 'bg-transparent border-2 border-dashed border-border-strong rounded-md opacity-60';
          } else if (el.tipo === 'decoracion') {
            estilo = 'bg-success-subtle/60 border border-success/25 rounded-full opacity-70';
          } else if (esParedFina) {
            estilo = 'bg-[#3d3a36] border-0 rounded-full opacity-70';
          }
          return (
            <div
              key={el.id}
              className={cn('pointer-events-none absolute', estilo)}
              style={{
                left: el.posX * cell,
                top: el.posY * cell,
                width: el.ancho * cell,
                height: el.alto * cell,
                transform: `rotate(${el.rotacion}deg)`,
              }}
              title={el.etiqueta ?? el.tipo}
            />
          );
        })}

        {mesasSorted.map((mesa) => {
          const estado = estadoPorMesa[mesa.id] ?? 'ocupada';
          const esRedonda = mesa.forma === 'redonda';
          const clickable = !disabled && (estado === 'libre' || estado === 'actual');

          const estilo =
            estado === 'actual'
              ? 'border-primary bg-primary/15 text-primary ring-2 ring-primary/40'
              : estado === 'libre'
                ? 'border-success/50 bg-success-subtle text-success-foreground hover:ring-2 hover:ring-success/35'
                : estado === 'chica'
                  ? 'border-warning/40 bg-warning-subtle/70 text-warning-foreground opacity-80'
                  : 'border-border bg-muted text-muted-foreground opacity-55';

          return (
            <button
              key={mesa.id}
              type="button"
              disabled={!clickable}
              onClick={() => onElegir(mesa.id)}
              className={cn(
                'absolute flex flex-col items-center justify-center overflow-hidden border-2 transition-all',
                esRedonda ? 'rounded-full' : 'rounded-[28%]',
                clickable ? 'cursor-pointer' : 'cursor-not-allowed',
                estilo,
              )}
              style={{
                left: mesa.posX * cell,
                top: mesa.posY * cell,
                width: mesa.ancho * cell,
                height: mesa.alto * cell,
                transform: `rotate(${mesa.rotacion}deg)`,
                zIndex: estado === 'actual' ? 5 : 1,
              }}
              title={
                estado === 'libre'
                  ? `Mesa ${mesa.identificador} · ${mesa.capacidad} lugares · disponible`
                  : estado === 'actual'
                    ? `Mesa ${mesa.identificador} · asignada a esta reserva`
                    : estado === 'chica'
                      ? `Mesa ${mesa.identificador} · solo ${mesa.capacidad} lugares (grupo más grande)`
                      : `Mesa ${mesa.identificador} · ocupada en este horario`
              }
            >
              <span className="max-w-full truncate px-1 text-center text-sm font-semibold leading-tight">
                {mesa.identificador}
              </span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[11px] opacity-80">
                <Users size={11} />
                {mesa.capacidad}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
