'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock,
  CookingPot,
  Bike,
  PackageCheck,
  Receipt,
  XCircle,
  Plus,
  Share2,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { PaymentMethodModal } from '@/features/pagos/components/PaymentMethodModal';
import type { MetodoPago } from '@/features/pagos/get-metodos-pago';
import type { SeguimientoPedido as SeguimientoData } from '../obtenerSeguimiento';

type Props = {
  pedido: SeguimientoData;
  tenantId: string;
  metodosPago: MetodoPago[];
  pagado: boolean;
  permiteAgregar: boolean;
  autoAbrirPago?: boolean;
};

const PASOS_DELIVERY = ['Recibido', 'EnPreparacion', 'Listo', 'EnCamino', 'Entregado'] as const;
const PASOS_TAKEAWAY = ['Recibido', 'EnPreparacion', 'Listo', 'Entregado'] as const;

const ICONO: Record<string, typeof Check> = {
  Recibido: Receipt,
  EnPreparacion: CookingPot,
  Listo: PackageCheck,
  EnCamino: Bike,
  Entregado: Check,
};

function tituloPaso(estado: string, tipo: 'takeaway' | 'delivery'): string {
  switch (estado) {
    case 'Recibido':
      return 'Pedido recibido';
    case 'EnPreparacion':
      return 'En preparación';
    case 'Listo':
      return tipo === 'delivery' ? 'Listo para enviar' : 'Listo para retirar';
    case 'EnCamino':
      return 'En camino';
    case 'Entregado':
      return tipo === 'delivery' ? 'Entregado' : 'Retirado';
    default:
      return estado;
  }
}

function detallePaso(estado: string, tipo: 'takeaway' | 'delivery'): string {
  switch (estado) {
    case 'Recibido':
      return 'El local ya tomó tu pedido';
    case 'EnPreparacion':
      return 'Lo estamos cocinando';
    case 'Listo':
      return tipo === 'delivery' ? 'Sale para tu dirección' : 'Ya podés pasar a retirarlo';
    case 'EnCamino':
      return 'El pedido va camino a vos';
    case 'Entregado':
      return '¡Que lo disfrutes!';
    default:
      return '';
  }
}

export function SeguimientoPedido({
  pedido,
  tenantId,
  metodosPago,
  pagado,
  permiteAgregar,
  autoAbrirPago = false,
}: Props) {
  const router = useRouter();
  const { sesionMesaId, tipo, estadoEntrega } = pedido;
  const [showPay, setShowPay] = useState(autoAbrirPago && pedido.saldoPendiente > 0);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`mesa_${sesionMesaId}`)
      .on('broadcast', { event: 'estado_entrega_actualizado' }, () => router.refresh())
      .on('broadcast', { event: 'pago_completado' }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sesionMesaId, router]);

  const cancelado = estadoEntrega === 'Cancelado';
  const pasos: readonly string[] = tipo === 'delivery' ? PASOS_DELIVERY : PASOS_TAKEAWAY;
  const actual = pasos.indexOf(estadoEntrega);

  const hora = pedido.horaEstimada
    ? new Date(pedido.horaEstimada).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/pedir?sesion=${sesionMesaId}`
      : `/pedir?sesion=${sesionMesaId}`;

  const compartir = async () => {
    const text = `Seguí mi pedido: ${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mi pedido', text, url: shareUrl });
        return;
      }
    } catch {
      // canceló o no soportado → copiar
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center bg-muted/30 px-4 py-8 pb-24">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-1 rounded-2xl border bg-card p-6 text-center shadow-sm">
          <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {tipo === 'delivery' ? 'Envío a domicilio' : 'Retiro en local'}
          </span>
          <h1 className="font-display pt-2 text-2xl font-semibold tracking-tight">
            Seguí tu pedido
          </h1>
          <p className="text-sm text-muted-foreground">
            ¡Gracias, {pedido.nombreContacto}! Guardá este link: se actualiza solo.
          </p>
          {hora && !cancelado ? (
            <p className="flex items-center justify-center gap-1.5 pt-1 text-sm font-medium">
              <Clock className="size-4" aria-hidden />
              {tipo === 'delivery' ? 'Llega aprox.' : 'Listo aprox.'} {hora}
            </p>
          ) : null}
        </div>

        {/* Estado de pago */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl border p-4',
            pagado
              ? 'border-success/30 bg-success-subtle text-success-foreground'
              : 'border-warning/30 bg-warning-subtle text-warning-foreground',
          )}
        >
          {pagado ? (
            <Check className="size-5 shrink-0" aria-hidden />
          ) : (
            <Clock className="size-5 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {pagado
                ? 'Pago confirmado'
                : pedido.totalPagado > 0
                  ? 'Pago parcial'
                  : 'Pedido tomado · pago pendiente'}
            </p>
            <p className="opacity-90">
              {pagado
                ? 'El local ya registró tu cobro.'
                : pedido.totalPagado > 0
                  ? `Te queda un saldo de ${formatPeso(pedido.saldoPendiente)}.`
                  : tipo === 'delivery'
                    ? 'Podés pagar ahora online o al recibir.'
                    : 'Podés pagar ahora online o al retirar en el local.'}
            </p>
          </div>
        </div>

        {!cancelado && (pedido.saldoPendiente > 0 || permiteAgregar) ? (
          <div className="grid grid-cols-1 gap-2">
            {pedido.saldoPendiente > 0 && metodosPago.length > 0 ? (
              <Button
                type="button"
                size="lg"
                className="h-12 w-full justify-between text-base"
                onClick={() => setShowPay(true)}
              >
                <span>Pagar ahora</span>
                <span className="tabular-nums">{formatPeso(pedido.saldoPendiente)}</span>
              </Button>
            ) : null}
            {permiteAgregar ? (
              <Button asChild variant="outline" size="lg" className="h-12 w-full">
                <Link href={`/pedir?sesion=${sesionMesaId}&agregar=1`}>
                  <Plus className="size-4" aria-hidden />
                  Agregar más productos
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => void compartir()}>
            {copiado ? (
              <>
                <CheckCheck className="size-4" aria-hidden />
                Link copiado
              </>
            ) : (
              <>
                <Share2 className="size-4" aria-hidden />
                Compartir seguimiento
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Copiar link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              } catch {
                // ignore
              }
            }}
          >
            <Copy className="size-4" />
          </Button>
        </div>

        {/* Stepper */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {cancelado ? (
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="size-6 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Pedido cancelado</p>
                <p className="text-sm text-muted-foreground">
                  Si creés que es un error, comunicate con el local.
                </p>
              </div>
            </div>
          ) : (
            <ol className="space-y-0">
              {pasos.map((paso, i) => {
                const Icono = ICONO[paso] ?? Check;
                const completado = i < actual;
                const activo = i === actual;
                const esUltimo = i === pasos.length - 1;
                return (
                  <li key={paso} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          completado && 'border-success bg-success text-success-foreground',
                          activo &&
                            !completado &&
                            'animate-pulse border-primary bg-primary text-primary-foreground',
                          !completado &&
                            !activo &&
                            'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        {completado ? (
                          <Check className="size-5" aria-hidden />
                        ) : (
                          <Icono className="size-5" aria-hidden />
                        )}
                      </div>
                      {!esUltimo ? (
                        <div
                          className={cn(
                            'min-h-8 w-0.5 flex-1',
                            completado ? 'bg-success' : 'bg-border',
                          )}
                        />
                      ) : null}
                    </div>
                    <div className={esUltimo ? '' : 'pb-6'}>
                      <p
                        className={cn(
                          'font-semibold',
                          activo || completado ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {tituloPaso(paso, tipo)}
                      </p>
                      {(activo || completado) && (
                        <p className="text-sm text-muted-foreground">
                          {detallePaso(paso, tipo)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Resumen */}
        <div className="space-y-3 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-semibold">Tu pedido</h2>
          <div className="space-y-2">
            {pedido.items.map((it) => (
              <div key={it.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{it.cantidad}×</span> {it.nombre}
                  {it.modificadores.length > 0 ? (
                    <span className="ml-5 block text-xs text-muted-foreground">
                      {it.modificadores.map((m) => `+ ${m.nombre}`).join(', ')}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPeso(it.subtotal)}
                </span>
              </div>
            ))}
          </div>
          {pedido.descuento > 0 ? (
            <>
              <div className="flex justify-between border-t pt-2 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPeso(pedido.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-success-foreground">
                <span>Descuento</span>
                <span className="tabular-nums">−{formatPeso(pedido.descuento)}</span>
              </div>
            </>
          ) : null}
          {pedido.costoEnvio > 0 ? (
            <div
              className={cn(
                'flex justify-between text-sm text-muted-foreground',
                pedido.descuento > 0 ? '' : 'border-t pt-2',
              )}
            >
              <span>Envío</span>
              <span className="tabular-nums">{formatPeso(pedido.costoEnvio)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-3 font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatPeso(pedido.totalConDescuento + pedido.costoEnvio)}
            </span>
          </div>
          {tipo === 'delivery' && pedido.direccion ? (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Enviamos a: {pedido.direccion}
              {pedido.referencia ? ` (${pedido.referencia})` : ''}
            </p>
          ) : null}
        </div>

        <Link
          href="/pedir"
          className="block py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Hacer otro pedido
        </Link>
      </div>

      <PaymentMethodModal
        isOpen={showPay}
        onClose={() => setShowPay(false)}
        sesionMesaId={sesionMesaId}
        tenantId={tenantId}
        metodosPago={metodosPago}
        externo
      />
    </main>
  );
}
