'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/shared/lib/utils';
import { queryKeys } from '@/shared/query/keys';
import { Dialog, DialogContent } from '@/shared/ui/dialog';
import { getCajaActualAction } from '@/features/caja/cajaActions';
import {
  cobrarVentaMostradorAction,
  iniciarVentaMostradorMpAction,
  cancelarVentaMostradorMpAction,
  type VentaMostradorTicket,
} from '../ventaMostradorActions';
import type { Step, Metodo, MpData } from '../types';
import { useVentaMostradorData } from '../hooks/useVentaMostradorData';
import { useCarritoVenta } from '../hooks/useCarritoVenta';
import { useVentaPreview } from '../hooks/useVentaPreview';
import { CajaCerradaGate } from './CajaCerradaGate';
import { PasoArmar } from './PasoArmar';
import { PasoCobrar } from './PasoCobrar';
import { PasoMercadoPago } from './PasoMercadoPago';
import { PasoCobrada } from './PasoCobrada';

/** Orquestador del flujo: máquina de pasos (armar → cobrar → MP → cobrada). */
export function VentaMostradorFlow({
  tenantId,
  onOpenChange,
}: {
  tenantId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { menu, mpDisponible } = useVentaMostradorData(tenantId);

  // Sin caja abierta no dejamos armar la venta: el cobro en efectivo (y el
  // arqueo) necesitan un turno. Refrescamos al abrir el modal.
  const {
    data: caja,
    isPending: cajaPending,
    isFetching: cajaFetching,
    isError: cajaError,
  } = useQuery({
    queryKey: queryKeys.caja(tenantId),
    queryFn: () => getCajaActualAction(),
    // Siempre revalidar al abrir el modal: si acaba de abrir la caja en otra pestaña,
    // no queremos un cache viejo “cerrada”.
    staleTime: 0,
  });
  // isPending solo en la primera carga sin data; si hay cache (null) y re-fetch, usamos
  // isFetching para no flashar el gate con un resultado viejo al reabrir.
  const cajaLoading = cajaPending || (cajaFetching && caja === undefined);
  const cajaCerrada = !cajaLoading && (cajaError || caja == null);
  const {
    cart,
    agregarProducto,
    agregarLibre,
    cambiarCantidad,
    quitarLinea,
    limpiar,
    total,
    cantidadItems,
    items,
  } = useCarritoVenta();

  const [step, setStep] = useState<Step>('armando');
  const [nombreRef, setNombreRef] = useState('');
  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [omitirIds, setOmitirIds] = useState<string[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mp, setMp] = useState<MpData | null>(null);
  const [ticket, setTicket] = useState<VentaMostradorTicket | null>(null);

  // Preview de promos (subtotal/descuento/total) según método + promos quitadas.
  const { preview, cargando: previewCargando } = useVentaPreview({
    items,
    metodo,
    omitirIds,
    enabled: step === 'cobrando',
  });
  // Mientras carga o si falla, caemos al total local sin descuento.
  const subtotalCobro = preview?.subtotal ?? total;
  const descuentoCobro = preview?.descuento ?? 0;
  const totalCobro = preview?.total ?? total;
  const aplicadas = preview?.aplicadas ?? [];

  const cerrar = () => onOpenChange(false);

  const reiniciar = () => {
    limpiar();
    setNombreRef('');
    setMetodo('efectivo');
    setMontoRecibido('');
    setOmitirIds([]);
    setError(null);
    setMp(null);
    setTicket(null);
    setStep('armando');
  };

  // Si se cierra el modal con un cobro de MP a medias (sin confirmar), cancelarlo
  // para no dejar una sesión de mostrador abierta sin pagar.
  const handleOpenChange = (next: boolean) => {
    if (!next && step === 'mp_esperando' && mp) {
      cancelarVentaMostradorMpAction(mp.sesionId).catch(() => {});
    }
    if (!next) onOpenChange(false);
  };

  const irACobrar = () => {
    if (cart.length === 0) return;
    setError(null);
    setMontoRecibido('');
    setMetodo('efectivo');
    setOmitirIds([]);
    setStep('cobrando');
  };

  const quitarPromo = (id: string) =>
    setOmitirIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const confirmarCobro = async () => {
    setProcesando(true);
    setError(null);
    try {
      if (metodo === 'mercado_pago') {
        const res = await iniciarVentaMostradorMpAction(items, {
          nombreReferencia: nombreRef,
          omitirIds,
        });
        if (!res.success || !res.paymentUrl || !res.sesionId) {
          setError(res.message ?? 'No se pudo iniciar el cobro');
          return;
        }
        setMp({
          sesionId: res.sesionId,
          transactionId: res.transactionId!,
          pedidoId: res.pedidoId!,
          paymentUrl: res.paymentUrl,
          subtotal: res.subtotal ?? total,
          descuento: res.descuento ?? 0,
          total: res.total ?? total,
          cantidadItems: res.cantidadItems ?? cantidadItems,
        });
        setStep('mp_esperando');
        return;
      }

      const res = await cobrarVentaMostradorAction(items, {
        metodoPago: metodo,
        nombreReferencia: nombreRef,
        montoRecibido: parseFloat(montoRecibido.replace(',', '.')) || 0,
        omitirIds,
      });
      if (!res.success || !res.ticket) {
        setError(res.message ?? 'No se pudo cobrar la venta');
        return;
      }
      setTicket({
        ...res.ticket,
        nombreReferencia: nombreRef.trim() || null,
        lineas: cart.map((l) => ({
          nombre:
            l.modificadoresNombres.length > 0
              ? `${l.nombre} (${l.modificadoresNombres.join(', ')})`
              : l.nombre,
          cantidad: l.cantidad,
          subtotal: l.precioUnitario * l.cantidad,
        })),
      });
      setStep('cobrada');
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(tenantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
    } finally {
      setProcesando(false);
    }
  };

  // MP aprobado (vía realtime o polling de respaldo): pasar a "Venta cobrada".
  const onMpAprobado = () => {
    if (!mp) return;
    setTicket({
      sesionId: mp.sesionId,
      pedidoId: mp.pedidoId,
      pedidoRef: `#${mp.pedidoId.slice(0, 4).toUpperCase()}`,
      subtotal: mp.subtotal,
      descuento: mp.descuento,
      total: mp.total,
      metodo: 'mercado_pago',
      vuelto: 0,
      cantidadItems: mp.cantidadItems,
      horaISO: new Date().toISOString(),
      nombreReferencia: nombreRef.trim() || null,
      lineas: cart.map((l) => ({
        nombre:
          l.modificadoresNombres.length > 0
            ? `${l.nombre} (${l.modificadoresNombres.join(', ')})`
            : l.nombre,
        cantidad: l.cantidad,
        subtotal: l.precioUnitario * l.cantidad,
      })),
    });
    setStep('cobrada');
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(tenantId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
  };

  const cancelarMp = async () => {
    if (mp) await cancelarVentaMostradorMpAction(mp.sesionId).catch(() => {});
    setMp(null);
    setStep('cobrando');
  };

  const mostrarFlujoCompleto = !cajaLoading && !cajaCerrada;
  const dialogWide = mostrarFlujoCompleto && step === 'armando';

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={step !== 'cobrada' || cajaCerrada}
        className={cn('block p-0', dialogWide ? 'sm:max-w-4xl' : 'sm:max-w-md')}
      >
        {cajaLoading && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="size-8 animate-pulse rounded-full bg-muted" />
            <p className="text-sm text-muted-foreground">Comprobando caja…</p>
          </div>
        )}

        {cajaCerrada && <CajaCerradaGate onCerrar={cerrar} />}

        {mostrarFlujoCompleto && step === 'armando' && (
          <PasoArmar
            menu={menu}
            cart={cart}
            total={total}
            nombreRef={nombreRef}
            setNombreRef={setNombreRef}
            onAgregar={agregarProducto}
            onAgregarLibre={agregarLibre}
            onCambiarCantidad={cambiarCantidad}
            onQuitar={quitarLinea}
            onCobrar={irACobrar}
            onCancelar={cerrar}
          />
        )}

        {mostrarFlujoCompleto && step === 'cobrando' && (
          <PasoCobrar
            subtotal={subtotalCobro}
            descuento={descuentoCobro}
            total={totalCobro}
            aplicadas={aplicadas}
            previewCargando={previewCargando}
            cantidadItems={cantidadItems}
            metodo={metodo}
            setMetodo={setMetodo}
            mpDisponible={mpDisponible}
            montoRecibido={montoRecibido}
            setMontoRecibido={setMontoRecibido}
            procesando={procesando}
            error={error}
            onVolver={() => setStep('armando')}
            onConfirmar={confirmarCobro}
            onQuitarPromo={quitarPromo}
          />
        )}

        {mostrarFlujoCompleto && step === 'mp_esperando' && mp && (
          <PasoMercadoPago
            mp={mp}
            onAprobado={onMpAprobado}
            onCancelar={cancelarMp}
            onError={(m) => {
              setError(m);
              setMp(null);
              setStep('cobrando');
            }}
          />
        )}

        {mostrarFlujoCompleto && step === 'cobrada' && ticket && (
          <PasoCobrada ticket={ticket} onNuevaVenta={reiniciar} onCerrar={cerrar} />
        )}
      </DialogContent>
    </Dialog>
  );
}
