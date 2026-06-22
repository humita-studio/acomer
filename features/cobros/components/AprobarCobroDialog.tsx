'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import { formatPeso, formatHora } from '@/shared/lib/format';
import { metodoInfo, esEfectivo } from '@/features/cobros/metodos';
import type { TransaccionCobro } from '@/features/cobros/types';

export type AprobarVars = { id: string; montoRecibido?: number };

export function AprobarCobroDialog({
  tx,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  tx: TransaccionCobro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (vars: AprobarVars) => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        {/* `key` reinicia el formulario por cobro: el estado se siembra desde
            las props sin necesidad de un efecto. */}
        {tx && (
          <AprobarCobroForm
            key={tx.id}
            tx={tx}
            onOpenChange={onOpenChange}
            onConfirm={onConfirm}
            pending={pending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AprobarCobroForm({
  tx,
  onOpenChange,
  onConfirm,
  pending,
}: {
  tx: TransaccionCobro;
  onOpenChange: (open: boolean) => void;
  onConfirm: (vars: AprobarVars) => void;
  pending: boolean;
}) {
  const [montoRecibido, setMontoRecibido] = useState('');

  const metodo = metodoInfo(tx.proveedor);
  const conVuelto = esEfectivo(tx.proveedor);
  const total = Number(tx.monto);
  const recibido = Number(montoRecibido);
  const recibidoValido = montoRecibido !== '' && Number.isFinite(recibido) && recibido >= total;
  const vuelto = recibidoValido ? recibido - total : 0;

  const handleConfirm = () => {
    onConfirm({
      id: tx.id,
      montoRecibido: conVuelto && montoRecibido !== '' ? recibido : undefined,
    });
  };

  return (
    <>
      <DialogHeader className="px-6 py-5">
        <DialogTitle>Aprobar cobro</DialogTitle>
        <DialogDescription>
          Mesa {tx.mesaIdentificador} · {formatHora(tx.fecha)} hs
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 border-t border-border px-6 py-5">
        {/* Método solicitado (lo eligió el cliente al pedir la cuenta; el total
            ya viene con el descuento de ese método). */}
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Método de pago
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
            <div className={cn('flex size-9 items-center justify-center rounded-md', metodo.iconBox)}>
              <metodo.Icon className="size-4.5" />
            </div>
            <span className="text-sm font-medium text-foreground">{metodo.label}</span>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
          <span className="text-sm text-muted-foreground">Total a cobrar</span>
          <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {formatPeso(total)}
          </span>
        </div>

        {/* Calculadora de vuelto (solo efectivo) */}
        {conVuelto && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="monto-recibido"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Monto recibido
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="monto-recibido"
                  inputMode="numeric"
                  placeholder="0"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value.replace(/[^\d]/g, ''))}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Vuelto
              </p>
              <div
                className={cn(
                  'flex h-9 items-center rounded-md px-3 text-sm font-semibold tabular-nums',
                  recibidoValido
                    ? 'bg-success-subtle text-success-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {formatPeso(vuelto)}
              </div>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="border-t border-border px-6 py-4">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={pending}>
          {pending ? 'Confirmando…' : 'Confirmar cobro'}
        </Button>
      </DialogFooter>
    </>
  );
}
