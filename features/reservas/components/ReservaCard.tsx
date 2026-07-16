'use client';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { AsignarMesaTrigger } from './AsignarMesaPopover';
import { estadoMeta } from '../estados';
import { horaDe } from '../fechas';
import type { Reserva } from '../types';

export type AccionConfirmable = 'NoShow' | 'Cancelada';

/** Tarjeta de una reserva en la agenda del día, con acciones según su estado. */
export function ReservaCard({
  reserva,
  busy,
  onConfirmar,
  onSentar,
  onMarcarCumplida,
  onPedirConfirmacion,
  onAbrirAsignarMesa,
}: {
  reserva: Reserva;
  busy: boolean;
  onConfirmar: (r: Reserva) => void;
  onSentar: (r: Reserva) => void;
  onMarcarCumplida: (r: Reserva) => void;
  onPedirConfirmacion: (r: Reserva, accion: AccionConfirmable) => void;
  onAbrirAsignarMesa: (r: Reserva) => void;
}) {
  const meta = estadoMeta(reserva.estado);
  const puedeAsignar =
    reserva.estado === 'Pendiente' || reserva.estado === 'Confirmada';
  const puedeSentar =
    (reserva.estado === 'Confirmada' || reserva.estado === 'Pendiente') && !!reserva.mesaId;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm sm:px-[18px]">
      {/* Horario + cantidad */}
      <div className="flex w-[84px] flex-col items-center justify-center px-1">
        <p className="text-lg font-semibold tabular-nums">{horaDe(reserva.inicio)}</p>
        <p className="text-[11px] text-muted-foreground">{reserva.cantidadPersonas} pers</p>
      </div>

      <div className="h-10 w-px shrink-0 bg-border" />

      {/* Contacto + mesa */}
      <div className="min-w-[140px] flex-1">
        <p className="font-semibold text-foreground">{reserva.nombreContacto}</p>
        {reserva.telefono ? (
          <a
            href={`https://wa.me/${reserva.telefono.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-muted-foreground hover:text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {reserva.telefono}
          </a>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sin teléfono</p>
        )}
        {reserva.mesaIdentificador ? (
          <p className="mt-0.5 text-xs font-medium text-foreground/80">
            Mesa {reserva.mesaIdentificador}
            {reserva.mesaCapacidad != null ? (
              <span className="font-normal text-muted-foreground">
                {' '}
                · {reserva.mesaCapacidad} lug.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Sin mesa asignada</p>
        )}
        {reserva.notas && <p className="mt-0.5 text-xs text-muted-foreground">{reserva.notas}</p>}
      </div>

      {/* Estado + acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            meta.pill,
          )}
        >
          <span className={cn('size-[7px] rounded-full', meta.dot)} />
          {meta.label}
        </span>

        {reserva.estado === 'Pendiente' && (
          <>
            <Button size="sm" disabled={busy} onClick={() => onConfirmar(reserva)}>
              Confirmar
            </Button>
            {puedeAsignar && (
              <AsignarMesaTrigger
                reserva={reserva}
                disabled={busy}
                onOpen={() => onAbrirAsignarMesa(reserva)}
              />
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onPedirConfirmacion(reserva, 'NoShow')}
            >
              No-show
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => onPedirConfirmacion(reserva, 'Cancelada')}
            >
              Cancelar
            </Button>
          </>
        )}

        {reserva.estado === 'Confirmada' && (
          <>
            <AsignarMesaTrigger
              reserva={reserva}
              disabled={busy}
              onOpen={() => onAbrirAsignarMesa(reserva)}
            />
            <Button
              size="sm"
              className="bg-success text-primary-foreground hover:bg-success/90"
              disabled={busy || !puedeSentar}
              onClick={() => onSentar(reserva)}
              title={!puedeSentar ? 'Asigná una mesa primero' : undefined}
            >
              Sentar
            </Button>
          </>
        )}

        {reserva.estado === 'Sentada' && (
          <Button
            size="sm"
            className="bg-foreground text-background hover:bg-foreground/90"
            disabled={busy}
            onClick={() => onMarcarCumplida(reserva)}
          >
            Marcar cumplida
          </Button>
        )}
      </div>
    </div>
  );
}
