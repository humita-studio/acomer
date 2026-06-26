'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Clock, CookingPot, Bike, PackageCheck, Receipt, XCircle, Plus } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { PaymentMethodModal } from '@/features/pagos/components/PaymentMethodModal';
import type { MetodoPago } from '@/features/pagos/get-metodos-pago';
import type { SeguimientoPedido as SeguimientoData } from '../obtenerSeguimiento';

type Props = {
  pedido: SeguimientoData;
  tenantId: string;
  metodosPago: MetodoPago[];
  // pagado puede venir forzado desde el retorno de pago (el webhook puede tardar
  // unos segundos en aprobar; igual mostramos "pago realizado").
  pagado: boolean;
  // El local permite sumar productos a este pedido (según estado + config).
  permiteAgregar: boolean;
  // Abrir el modal de pago al montar (viene del checkout con pagar=1).
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
      return 'Tomamos tu pedido';
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

  // Realtime: el staff avanza el estado (o se aprueba el pago) → refrescar.
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
    ? new Date(pedido.horaEstimada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <main className="min-h-screen bg-muted/30 flex flex-col items-center px-4 py-8 pb-24">
      <div className="w-full max-w-md space-y-4">
        {/* Encabezado */}
        <div className="bg-card border rounded-2xl shadow-sm p-6 text-center space-y-1">
          <span className="inline-block bg-muted rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
            {tipo === 'delivery' ? '🛵 Envío a domicilio' : '🏬 Retiro en local'}
          </span>
          <h1 className="text-2xl font-bold pt-2">Seguí tu pedido</h1>
          <p className="text-sm text-muted-foreground">
            ¡Gracias, {pedido.nombreContacto}! Te avisamos acá cada paso.
          </p>
          {hora && !cancelado && (
            <p className="text-sm font-medium pt-1 flex items-center justify-center gap-1.5">
              <Clock className="size-4" />
              {tipo === 'delivery' ? 'Llega aprox.' : 'Listo aprox.'} {hora}
            </p>
          )}
        </div>

        {/* Estado de pago */}
        <div
          className={`rounded-2xl border p-4 flex items-center gap-3 ${
            pagado
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {pagado ? <Check className="size-5 shrink-0" /> : <Clock className="size-5 shrink-0" />}
          <div className="text-sm">
            <p className="font-semibold">
              {pagado ? 'Pago confirmado' : pedido.totalPagado > 0 ? 'Pago parcial' : 'Pago pendiente'}
            </p>
            <p className="opacity-80">
              {pagado
                ? '¡Listo! Ya recibimos tu pago.'
                : pedido.totalPagado > 0
                  ? `Te queda un saldo de $${pedido.saldoPendiente.toFixed(2)}.`
                  : tipo === 'delivery'
                    ? 'Pagás al recibir tu pedido (o ahora online).'
                    : 'Pagás al retirarlo en el local (o ahora online).'}
            </p>
          </div>
        </div>

        {/* Acciones: pagar saldo / agregar más productos */}
        {!cancelado && (pedido.saldoPendiente > 0 || permiteAgregar) && (
          <div className="grid grid-cols-1 gap-2">
            {pedido.saldoPendiente > 0 && metodosPago.length > 0 && (
              <button
                onClick={() => setShowPay(true)}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-sm flex justify-between px-5 items-center"
              >
                <span>Pagar ahora</span>
                <span className="tabular-nums">${pedido.saldoPendiente.toFixed(2)}</span>
              </button>
            )}
            {permiteAgregar && (
              <Link
                href={`/pedir?sesion=${sesionMesaId}&agregar=1`}
                className="w-full bg-card border font-semibold py-3 rounded-xl shadow-sm flex justify-center items-center gap-2 hover:bg-muted/50"
              >
                <Plus className="size-4" />
                Agregar más productos
              </Link>
            )}
          </div>
        )}

        {/* Stepper de estado */}
        <div className="bg-card border rounded-2xl shadow-sm p-6">
          {cancelado ? (
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="size-6 shrink-0" />
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
                    {/* Columna del ícono + línea */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          completado
                            ? 'bg-green-600 border-green-600 text-white'
                            : activo
                              ? 'bg-primary border-primary text-primary-foreground animate-pulse'
                              : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {completado ? <Check className="size-5" /> : <Icono className="size-5" />}
                      </div>
                      {!esUltimo && (
                        <div
                          className={`w-0.5 flex-1 min-h-8 ${completado ? 'bg-green-600' : 'bg-border'}`}
                        />
                      )}
                    </div>
                    {/* Texto */}
                    <div className={esUltimo ? '' : 'pb-6'}>
                      <p
                        className={`font-semibold ${
                          activo ? 'text-foreground' : completado ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {tituloPaso(paso, tipo)}
                      </p>
                      {(activo || completado) && (
                        <p className="text-sm text-muted-foreground">{detallePaso(paso, tipo)}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Resumen del pedido */}
        <div className="bg-card border rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="font-semibold">Tu pedido</h2>
          <div className="space-y-2">
            {pedido.items.map((it) => (
              <div key={it.id} className="flex justify-between text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{it.cantidad}×</span> {it.nombre}
                  {it.modificadores.length > 0 && (
                    <span className="block text-xs text-muted-foreground ml-5">
                      {it.modificadores.map((m) => `+ ${m.nombre}`).join(', ')}
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">${it.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {pedido.descuento > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground border-t pt-2">
                <span>Subtotal</span>
                <span className="tabular-nums">${pedido.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento</span>
                <span className="tabular-nums">−${pedido.descuento.toFixed(2)}</span>
              </div>
            </>
          )}
          {pedido.costoEnvio > 0 && (
            <div
              className={`flex justify-between text-sm text-muted-foreground ${
                pedido.descuento > 0 ? '' : 'border-t pt-2'
              }`}
            >
              <span>Envío</span>
              <span className="tabular-nums">${pedido.costoEnvio.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-3">
            <span>Total</span>
            <span className="tabular-nums">
              ${(pedido.totalConDescuento + pedido.costoEnvio).toFixed(2)}
            </span>
          </div>
          {tipo === 'delivery' && pedido.direccion && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              Enviamos a: {pedido.direccion}
              {pedido.referencia ? ` (${pedido.referencia})` : ''}
            </p>
          )}
        </div>

        <Link
          href="/pedir"
          className="block text-center text-sm font-medium text-muted-foreground hover:text-foreground py-2"
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
