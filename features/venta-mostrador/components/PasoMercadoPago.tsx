'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Loader2 } from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import type { MpData } from '../types';
import { useEsperaPagoMp } from '../hooks/useEsperaPagoMp';

/** Paso 2.5 — QR de Mercado Pago + espera de confirmación (realtime + respaldo). */
export function PasoMercadoPago({
  mp,
  onAprobado,
  onCancelar,
  onError,
}: {
  mp: MpData;
  onAprobado: () => void;
  onCancelar: () => void;
  onError: (msg: string) => void;
}) {
  useEsperaPagoMp(mp, onAprobado, onError);

  return (
    <div className="space-y-5 p-6 text-center">
      <div className="space-y-0.5">
        <DialogTitle className="font-display text-xl tracking-tight">Cobrar con Mercado Pago</DialogTitle>
        <DialogDescription>El cliente escanea el QR y paga · {formatPeso(mp.total)}</DialogDescription>
      </div>

      <div className="flex justify-center">
        <div className="rounded-2xl border bg-card p-4">
          <QRCodeSVG value={mp.paymentUrl} size={200} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Esperando confirmación del pago…
      </div>

      <div className="flex flex-col items-center gap-2">
        <a
          href={mp.paymentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          Abrir link de pago
        </a>
        <Button variant="outline" onClick={onCancelar} className="w-full">
          Cancelar cobro
        </Button>
      </div>
    </div>
  );
}
