'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Check,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import type { TicketData } from '../obtener-ticket-action';

type ResumenPagoProps = {
  ticket: TicketData;
  /** Estado forzado desde la URL (ej. retorno failure de MP). */
  pagoState?: string;
};

function metodoLabel(proveedor: string) {
  switch (proveedor) {
    case 'mercado_pago':
      return 'Mercado Pago';
    case 'efectivo':
      return 'Efectivo';
    case 'tarjeta_fisica':
      return 'Tarjeta en mesa';
    default:
      return proveedor;
  }
}

type Tone = 'success' | 'pending' | 'error' | 'neutral';

function resolveTone(
  estado: string,
  pagoState?: string,
): { tone: Tone; titulo: string; subtitulo?: string } {
  // Retorno de MP con fallo explícito en la URL (aunque la tx siga pendiente un instante).
  if (pagoState === 'error' || estado === 'Rechazado') {
    return {
      tone: 'error',
      titulo: 'No se pudo completar el pago',
      subtitulo: 'Podés intentar de nuevo desde la carta.',
    };
  }
  if (estado === 'Aprobado') {
    return {
      tone: 'success',
      titulo: '¡Pago exitoso!',
      subtitulo: 'Gracias. El local ya registró tu cobro.',
    };
  }
  if (estado === 'Cancelado') {
    return {
      tone: 'error',
      titulo: 'Pago cancelado',
      subtitulo: 'Se actualizó la cuenta de la mesa. Generá un cobro nuevo.',
    };
  }
  if (estado === 'Pendiente' || pagoState === 'pendiente') {
    return {
      tone: 'pending',
      titulo: 'Pago pendiente',
      subtitulo: undefined,
    };
  }
  return { tone: 'neutral', titulo: 'Ticket de pago' };
}

const TONE_HEADER: Record<Tone, string> = {
  success: 'bg-success text-success-foreground',
  pending: 'bg-warning text-warning-foreground',
  error: 'bg-destructive text-destructive-foreground',
  neutral: 'bg-foreground text-background',
};

/**
 * Pantalla post-pago del comensal (mesa u online).
 * Escucha cambios de la tx en realtime (efectivo/tarjeta o webhook MP).
 */
export function ResumenPago({ ticket, pagoState }: ResumenPagoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { tone, titulo, subtitulo } = resolveTone(ticket.transaccion.estado, pagoState);

  const isApproved = ticket.transaccion.estado === 'Aprobado';
  const isPending = ticket.transaccion.estado === 'Pendiente' && pagoState !== 'error';
  const isCanceled = ticket.transaccion.estado === 'Cancelado';
  const isFailed =
    pagoState === 'error' || ticket.transaccion.estado === 'Rechazado';
  const esPresencial =
    ticket.transaccion.proveedor === 'efectivo' ||
    ticket.transaccion.proveedor === 'tarjeta_fisica';

  useEffect(() => {
    if (ticket.transaccion.estado !== 'Pendiente' && ticket.transaccion.estado !== 'Cancelado') {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`tx_${ticket.transaccion.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transacciones_pago',
          filter: `id=eq.${ticket.transaccion.id}`,
        },
        (payload) => {
          if (!payload.new) return;
          const hasStateChanged = payload.new.estado !== 'Pendiente';
          const hasAmountChanged = payload.new.monto !== ticket.transaccion.monto;
          if (hasStateChanged || hasAmountChanged) {
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.transaccion.id, ticket.transaccion.estado, ticket.transaccion.monto, router]);

  const handleVolver = () => {
    // Pedidos online: volver al seguimiento del pedido (no a un /pedir vacío).
    if (ticket.tipo === 'takeaway' || ticket.tipo === 'delivery') {
      router.replace(`/pedir?sesion=${ticket.sesionMesaId}`);
      return;
    }
    // Mesa: limpiar query params y reabrir la comanda.
    router.replace(pathname);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-muted/30 p-4 pb-24 sm:p-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-4">
        <div className={cn('p-8 text-center', TONE_HEADER[tone])}>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            {isApproved ? (
              <Check className="size-8" strokeWidth={2.5} aria-hidden />
            ) : isPending ? (
              <Clock className="size-8" strokeWidth={2.5} aria-hidden />
            ) : isFailed || isCanceled ? (
              <X className="size-8" strokeWidth={2.5} aria-hidden />
            ) : (
              <Loader2 className="size-8 animate-spin" aria-hidden />
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="mt-1 font-medium opacity-90">Mesa {ticket.mesaIdentificador}</p>
          {subtitulo ? <p className="mt-2 text-sm opacity-85">{subtitulo}</p> : null}
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex items-center justify-between border-b pb-4 text-sm">
            <span className="text-muted-foreground">Método de pago</span>
            <span className="font-semibold">
              {metodoLabel(ticket.transaccion.proveedor)}
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu pedido
            </h2>
            <div className="space-y-3">
              {ticket.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {item.cantidad}x {item.nombre}
                    </p>
                    {item.modificadores.length > 0 ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.modificadores.map((m) => `+ ${m.nombre}`).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatPeso(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-dashed pt-4">
            {ticket.totalPagado && ticket.totalPagado > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de la mesa</span>
                  <span className="font-semibold tabular-nums">
                    {formatPeso((ticket.saldoPendiente || 0) + ticket.totalPagado)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-success-foreground">
                  <span>Pagos previos</span>
                  <span className="tabular-nums">−{formatPeso(ticket.totalPagado)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-muted-foreground">Restante</span>
                  <span className="font-display text-3xl font-semibold tabular-nums">
                    {formatPeso(ticket.saldoPendiente || 0)}
                  </span>
                </div>
              </>
            ) : (
              <>
                {ticket.transaccion.descuento > 0 ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">
                        {formatPeso(
                          ticket.transaccion.monto + ticket.transaccion.descuento,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-success-foreground">
                      <span>Descuento</span>
                      <span className="tabular-nums">
                        −{formatPeso(ticket.transaccion.descuento)}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-muted-foreground">Total</span>
                  <span className="font-display text-3xl font-semibold tabular-nums">
                    {formatPeso(ticket.transaccion.monto)}
                  </span>
                </div>
              </>
            )}

            {isPending && esPresencial ? (
              <p className="mt-4 rounded-xl bg-warning-subtle p-3 text-center text-sm font-medium text-warning-foreground">
                Un mozo se acerca a tu mesa para cobrar.
              </p>
            ) : null}

            {isPending && ticket.transaccion.proveedor === 'mercado_pago' ? (
              <p className="mt-4 rounded-xl bg-warning-subtle p-3 text-center text-sm font-medium text-warning-foreground">
                Estamos confirmando el pago con Mercado Pago. Esta pantalla se actualiza sola.
              </p>
            ) : null}

            {isCanceled ? (
              <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
                La cuenta cambió (se sumaron platos u otro cobro). Volvé a la carta y pedí pagar de
                nuevo.
              </p>
            ) : null}

            {isFailed ? (
              <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
                El pago no se acreditó. No te preocupes: podés elegir otro medio o reintentar.
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t bg-muted/40 p-5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full text-base"
            onClick={handleVolver}
          >
            {ticket.tipo === 'takeaway' || ticket.tipo === 'delivery'
              ? isFailed
                ? 'Volver al pedido y reintentar'
                : 'Ver seguimiento del pedido'
              : isFailed
                ? 'Reintentar desde la carta'
                : 'Volver a la carta'}
          </Button>
        </div>
      </div>
    </div>
  );
}
