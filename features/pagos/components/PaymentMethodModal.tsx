'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Tag } from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import type { MetodoPago } from '../get-metodos-pago';
import { pedirCuentaAction } from '../pagos-actions';
import { pedirCuentaPresencialAction } from '../pago-presencial-action';
import {
  useCuentaComensalPreview,
  cuentaPreviewQueryOptions,
} from '@/features/promociones/useCuentaComensalPreview';
import type { PromoMetodoPago } from '@/features/promociones/promociones';
import type { ResultadoPromos } from '@/features/promociones/aplicarPromociones';

type PaymentMethodModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sesionMesaId: string;
  tenantId: string;
  metodosPago: MetodoPago[];
  // Pedido de retiro/envío: el pago presencial es "al recibir/retirar", no "en la mesa".
  externo?: boolean;
  // Cálculo instantáneo del descuento por método con el motor puro (flujo
  // "menú-primero", donde el carrito recién creado ES la cuenta). Si se pasa, no
  // hay round-trip ni "Calculando…". En el seguimiento ("Pagar ahora") no está y
  // se usa el preview del server (con prefetch al abrir para que igual sea fluido).
  previewLocal?: (metodo: PromoMetodoPago) => ResultadoPromos;
};

/** Mapea el id del método al método que entienden las condiciones de promo. */
function metodoPromo(id: string): PromoMetodoPago {
  if (id === 'mercado_pago') return 'mercado_pago';
  if (id === 'tarjeta_fisica') return 'tarjeta';
  return 'efectivo';
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  sesionMesaId,
  tenantId,
  metodosPago,
  externo = false,
  previewLocal,
}: PaymentMethodModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MetodoPago | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metodoSel = selected ? metodoPromo(selected.id) : null;

  // El preview del server se cachea por método (TanStack); cambiar de método no
  // recarga lo ya consultado. Sólo se usa cuando NO hay cálculo local.
  const { preview: serverPreview, cargando } = useCuentaComensalPreview({
    sesionMesaId,
    tenantId,
    metodoPago: previewLocal ? null : metodoSel,
  });

  // Con cálculo local el descuento es instantáneo (sin "Calculando…"); sin él,
  // se muestra el preview del server.
  const preview = previewLocal ? (metodoSel ? previewLocal(metodoSel) : null) : serverPreview;
  const cargandoPreview = previewLocal ? false : cargando;

  // Sin cálculo local (seguimiento): precalentar el cache de todos los métodos al
  // abrir, así el primer tap ya cae al cache en vez de mostrar "Calculando…".
  useEffect(() => {
    if (!isOpen || previewLocal || !sesionMesaId) return;
    const metodos = Array.from(new Set(metodosPago.map((m) => metodoPromo(m.id))));
    for (const m of metodos) {
      queryClient.prefetchQuery(cuentaPreviewQueryOptions(sesionMesaId, tenantId, m));
    }
  }, [isOpen, previewLocal, metodosPago, sesionMesaId, tenantId, queryClient]);

  const handleConfirm = async () => {
    if (!selected) return;
    setProcessing(true);
    setError(null);
    try {
      if (selected.id === 'mercado_pago') {
        const res = await pedirCuentaAction(sesionMesaId, tenantId, window.location.href);
        if (res.success && res.paymentUrl) {
          window.location.assign(res.paymentUrl);
          return; // redirigiendo
        }
        setError(res.message || 'Error al iniciar el pago con Mercado Pago.');
      } else {
        const res = await pedirCuentaPresencialAction(
          sesionMesaId,
          tenantId,
          selected.id as 'efectivo' | 'tarjeta_fisica',
        );
        if (res.success && res.transactionId) {
          // Destino interno → navegación "soft" (RSC) en vez de recargar todo el
          // documento: el seguimiento aparece sin el parpadeo de un full reload.
          router.push(`${window.location.pathname}?pago=pendiente&tx=${res.transactionId}`);
          return; // redirigiendo
        }
        setError(res.message ?? 'No se pudo solicitar la cuenta.');
      }
    } catch {
      setError('Sin conexión o error de red. Revisá internet e intentá de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setSelected(null);
    setError(null);
    onClose();
  };

  const hayDescuento = !!preview && preview.descuento > 0;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[90vh] flex-col gap-0 bg-background p-0 sm:max-w-md sm:rounded-t-2xl"
      >
        <SheetHeader className="border-b p-5">
          <SheetTitle className="text-xl">¿Cómo querés pagar?</SheetTitle>
          <SheetDescription>Elegí un método para ver el total.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {metodosPago.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Este local todavía no tiene medios de pago activos. Pedile al mozo que te cobre en
              la mesa.
            </div>
          ) : null}
          {metodosPago.map((metodo) => {
            const isSelected = selected?.id === metodo.id;
            return (
              <button
                key={metodo.id}
                type="button"
                onClick={() => setSelected(metodo)}
                disabled={processing}
                className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                } ${processing ? 'opacity-60' : ''}`}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                  {metodo.icono}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{metodo.nombre}</h3>
                    {metodo.tipo === 'digital' && (
                      <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {metodo.tipo === 'digital'
                      ? 'Pago online, al instante'
                      : externo
                        ? 'Pagás al recibir o al retirar'
                        : 'Pago en la mesa'}
                  </p>
                </div>
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                  }`}
                >
                  {isSelected && <span className="size-2 rounded-full bg-primary-foreground" />}
                </span>
              </button>
            );
          })}

          {/* Desglose del total para el método elegido */}
          {selected && (
            <div className="rounded-2xl bg-muted px-4 py-3">
              {cargandoPreview && !preview ? (
                <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Calculando…
                </div>
              ) : hayDescuento ? (
                <>
                  {preview!.aplicadas.map((p) => (
                    <div
                      key={p.id}
                      className="mb-2 flex items-center gap-2 text-sm text-success-foreground"
                    >
                      <Tag className="size-4 shrink-0" />
                      <span className="truncate font-medium">{p.nombre}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-0.5 text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatPeso(preview!.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 text-sm">
                    <span className="text-muted-foreground">Descuento</span>
                    <span className="tabular-nums text-success-foreground">
                      −{formatPeso(preview!.descuento)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
                    <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
                    <span className="text-2xl font-semibold tabular-nums">
                      {formatPeso(preview!.total)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {preview ? formatPeso(preview.total) : '—'}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t bg-muted/40 p-5">
          <Button
            onClick={handleConfirm}
            disabled={!selected || processing}
            size="lg"
            className="h-12 w-full text-base"
          >
            {processing && <Loader2 className="size-4 animate-spin" />}
            {selected?.id === 'mercado_pago' ? 'Pagar con Mercado Pago' : 'Confirmar pago'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            También podés cerrar y pagar después.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
