'use client';

import { Check, ShoppingCart, X } from 'lucide-react';
import { formatPeso, formatHora } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { TicketPrintButton } from '@/features/pagos/components/TicketPrintButton';
import type { VentaMostradorTicket } from '../ventaMostradorActions';
import { type Metodo, METODO_LABEL } from '../types';

/** Paso 3 — venta cobrada: confirmación + ticket imprimible. */
export function PasoCobrada({
  ticket,
  onNuevaVenta,
  onCerrar,
}: {
  ticket: VentaMostradorTicket;
  onNuevaVenta: () => void;
  onCerrar: () => void;
}) {
  const metodoLabel = METODO_LABEL[ticket.metodo as Metodo] ?? ticket.metodo;
  const subtitulo = [
    `Pedido ${ticket.pedidoRef}`,
    ticket.nombreReferencia?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5 p-6 text-center">
      <DialogTitle className="sr-only">Venta cobrada</DialogTitle>
      <DialogDescription className="sr-only">La venta se registró correctamente.</DialogDescription>

      <div className="flex justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
          <Check className="size-7" />
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-tight">Venta cobrada</h2>
        <p className="text-sm text-muted-foreground">
          {formatPeso(ticket.total)} · {metodoLabel}
          {ticket.vuelto > 0 && ` · vuelto ${formatPeso(ticket.vuelto)}`}
        </p>
        <p className="text-xs text-muted-foreground">Cobrado · pedido en cocina</p>
      </div>

      <dl className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mostrador</dt>
          <dd className="font-medium tabular-nums">Pedido {ticket.pedidoRef}</dd>
        </div>
        {ticket.nombreReferencia?.trim() && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Referencia</dt>
            <dd className="truncate font-medium">{ticket.nombreReferencia.trim()}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Ítems</dt>
          <dd className="font-medium tabular-nums">{ticket.cantidadItems}</dd>
        </div>
        {ticket.descuento > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Descuento</dt>
            <dd className="font-medium tabular-nums text-success-foreground">
              −{formatPeso(ticket.descuento)}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Cobrado</dt>
          <dd className="font-medium tabular-nums">{formatHora(ticket.horaISO)} hs</dd>
        </div>
      </dl>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        {ticket.lineas.length > 0 && (
          <TicketPrintButton
            ticket={{
              titulo: 'Venta de mostrador',
              subtitulo,
              lineas: ticket.lineas,
              total: ticket.total,
              descuento: ticket.descuento > 0 ? ticket.descuento : undefined,
              metodo: metodoLabel,
              fecha: ticket.horaISO,
              footer:
                ticket.vuelto > 0
                  ? `Vuelto: ${formatPeso(ticket.vuelto)} · Gracias por tu visita`
                  : 'Gracias por tu visita',
            }}
            variant="outline"
            size="default"
          />
        )}
        <Button variant="outline" onClick={onCerrar}>
          <X />
          Cerrar
        </Button>
        <Button onClick={onNuevaVenta}>
          <ShoppingCart />
          Nueva venta
        </Button>
      </div>
    </div>
  );
}
