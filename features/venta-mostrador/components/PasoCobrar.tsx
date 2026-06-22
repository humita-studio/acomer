'use client';

import { Loader2, Tag } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatPeso } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { type Metodo, METODO_LABEL } from '../types';

type PromoAplicada = { id: string; nombre: string; tipo: string; descuento: number };

/** Paso 2 — elegir método de pago, monto recibido / vuelto, y confirmar. */
export function PasoCobrar({
  subtotal,
  descuento,
  total,
  aplicadas,
  previewCargando,
  cantidadItems,
  metodo,
  setMetodo,
  mpDisponible,
  montoRecibido,
  setMontoRecibido,
  procesando,
  error,
  onVolver,
  onConfirmar,
  onQuitarPromo,
}: {
  /** Subtotal sin descuento. */
  subtotal: number;
  /** Monto descontado por promociones. */
  descuento: number;
  /** Total a cobrar (ya con descuento). */
  total: number;
  /** Promos que aplican al método elegido. */
  aplicadas: PromoAplicada[];
  previewCargando: boolean;
  cantidadItems: number;
  metodo: Metodo;
  setMetodo: (m: Metodo) => void;
  mpDisponible: boolean;
  montoRecibido: string;
  setMontoRecibido: (v: string) => void;
  procesando: boolean;
  error: string | null;
  onVolver: () => void;
  onConfirmar: () => void;
  onQuitarPromo: (id: string) => void;
}) {
  const metodos: Metodo[] = mpDisponible
    ? ['efectivo', 'tarjeta_fisica', 'mercado_pago']
    : ['efectivo', 'tarjeta_fisica'];

  const recibidoNum = parseFloat(montoRecibido.replace(',', '.')) || 0;
  const vuelto = Math.max(0, recibidoNum - total);
  const faltante = metodo === 'efectivo' && recibidoNum > 0 && recibidoNum < total;
  const hayDescuento = descuento > 0 && aplicadas.length > 0;

  return (
    <div className="space-y-5 p-6">
      <div className="space-y-0.5">
        <DialogTitle className="font-display text-xl tracking-tight">Cobrar venta</DialogTitle>
        <DialogDescription>
          Mostrador · {cantidadItems} {cantidadItems === 1 ? 'ítem' : 'ítems'}
        </DialogDescription>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Método de pago</p>
        <div className="flex flex-wrap gap-2">
          {metodos.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodo(m)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                metodo === m
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {METODO_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Promos aplicadas automáticamente según el método (removibles). */}
      {hayDescuento &&
        aplicadas.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-success-subtle px-4 py-3"
          >
            <div className="flex items-center gap-2 text-success-foreground">
              <Tag className="size-4 shrink-0" />
              <div className="leading-tight">
                <p className="text-sm font-semibold">{p.nombre}</p>
                <p className="text-xs opacity-80">Se aplicó automáticamente</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onQuitarPromo(p.id)}
              className="text-xs font-medium text-success-foreground underline-offset-2 hover:underline"
            >
              Quitar
            </button>
          </div>
        ))}

      <div className="rounded-2xl bg-muted px-4 py-3">
        {hayDescuento ? (
          <>
            <div className="flex items-center justify-between py-0.5 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatPeso(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between py-0.5 text-sm">
              <span className="text-muted-foreground">Descuento</span>
              <span className="tabular-nums text-success-foreground">−{formatPeso(descuento)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
              <span className="text-sm font-medium text-muted-foreground">Total a cobrar</span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {formatPeso(total)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Total a cobrar
              {previewCargando && <Loader2 className="ml-2 inline size-3.5 animate-spin" />}
            </span>
            <span className="font-display text-2xl font-semibold tabular-nums">{formatPeso(total)}</span>
          </div>
        )}
      </div>

      {metodo === 'efectivo' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Monto recibido
            </label>
            <Input
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              aria-invalid={faltante}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Vuelto</label>
            <div className="flex h-9 items-center rounded-3xl bg-success-subtle px-3 font-semibold tabular-nums text-success-foreground">
              {formatPeso(vuelto)}
            </div>
          </div>
        </div>
      )}

      {metodo === 'mercado_pago' && (
        <p className="text-sm text-muted-foreground">
          Vas a generar un QR de Mercado Pago para que el cliente lo escanee y pague.
        </p>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onVolver} disabled={procesando}>
          Volver
        </Button>
        <Button onClick={onConfirmar} disabled={procesando}>
          {procesando && <Loader2 className="animate-spin" />}
          {metodo === 'mercado_pago' ? 'Generar QR' : 'Confirmar cobro'}
        </Button>
      </div>
    </div>
  );
}
