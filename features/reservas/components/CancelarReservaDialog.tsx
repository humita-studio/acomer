'use client';

import { Ban, UserX } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import type { AccionConfirmable } from './ReservaCard';
import type { Reserva } from '../types';
import { horaDe } from '../fechas';

const COPY: Record<
  AccionConfirmable,
  { icon: typeof Ban; titulo: string; confirmar: string; detalle: string }
> = {
  Cancelada: {
    icon: Ban,
    titulo: '¿Cancelar esta reserva?',
    confirmar: 'Sí, cancelar',
    detalle: 'Se liberará el cupo del turno y la mesa asignada.',
  },
  NoShow: {
    icon: UserX,
    titulo: '¿Marcar como no-show?',
    confirmar: 'Sí, marcar no-show',
    detalle: 'Quedará registrada como no-show y se liberará la mesa.',
  },
};

/** Confirmación para cancelar una reserva o marcarla como no-show. */
export function CancelarReservaDialog({
  target,
  pending,
  onOpenChange,
  onConfirm,
}: {
  target: { reserva: Reserva; accion: AccionConfirmable } | null;
  pending: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
}) {
  const copy = target ? COPY[target.accion] : null;
  const Icon = copy?.icon ?? Ban;

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        {target && copy && (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Icon className="size-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground">{copy.titulo}</DialogTitle>
              <DialogDescription>
                {target.reserva.nombreContacto} · {horaDe(target.reserva.inicio)} ·{' '}
                {target.reserva.cantidadPersonas} personas. {copy.detalle}
              </DialogDescription>
            </div>
            <div className="mt-2 flex w-full justify-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                No, volver
              </Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={onConfirm}
                disabled={pending}
              >
                {copy.confirmar}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
