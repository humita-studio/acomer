'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/shared/lib/utils';
import { useMesasDisponibles } from '../hooks/useReservas';
import type { Reserva } from '../types';
import { horaDe } from '../fechas';

/**
 * Trigger + popover para elegir la mesa donde sentar una reserva. Lista las
 * mesas libres para su horario/cantidad (calculadas en el server).
 */
export function AsignarMesaPopover({
  reserva,
  chosen,
  onElegir,
}: {
  reserva: Reserva;
  chosen: { id: string; label: string } | null;
  onElegir: (mesaId: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const inicioISO = new Date(reserva.inicio).toISOString();
  const { data: mesas = [], isFetching } = useMesasDisponibles({
    inicioISO,
    personas: reserva.cantidadPersonas,
    duracionMin: reserva.duracionMin,
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {chosen?.label ?? 'Asignar mesa'}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-2 rounded-xl p-2">
        <div className="px-2 pt-1 pb-2">
          <p className="text-sm font-semibold text-foreground">Asignar mesa</p>
          <p className="text-xs text-muted-foreground">
            {reserva.nombreContacto} · {reserva.cantidadPersonas} personas · {horaDe(reserva.inicio)}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          {isFetching && <p className="px-2 py-3 text-sm text-muted-foreground">Buscando mesas…</p>}
          {!isFetching && mesas.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No hay mesas libres para este horario.
            </p>
          )}
          {!isFetching &&
            mesas.map((m) => {
              const label = `Mesa ${m.identificador}`;
              const sel = chosen?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onElegir(m.id, `${label} (${m.capacidad})`);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted',
                    sel && 'bg-accent',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded border',
                      sel ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
                    )}
                  >
                    {sel && <Check className="size-3" />}
                  </span>
                  <span className="flex-1 font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">{m.capacidad} lugares</span>
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
