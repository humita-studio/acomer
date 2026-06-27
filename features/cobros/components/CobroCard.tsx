'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatPeso, formatHora } from '@/shared/lib/format';
import { metodoInfo } from '@/features/cobros/metodos';
import type { TransaccionCobro } from '@/features/cobros/types';

/* ─── Tarjeta Pendiente ─────────────────────────────────────────────────── */

export function CobroPendienteCard({
  tx,
  onAprobar,
  onRechazar,
}: {
  tx: TransaccionCobro;
  onAprobar: (tx: TransaccionCobro) => void;
  onRechazar: (tx: TransaccionCobro) => void;
}) {
  const metodo = metodoInfo(tx.proveedor);
  const descuento = Number(tx.descuento);

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Cabecera: mesa + hora | icono del método */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit rounded-full bg-neutral-subtle px-2 py-0.5 text-xs font-semibold text-text-secondary">
            Mesa {tx.mesaIdentificador}
          </span>
          <span className="text-xs text-muted-foreground">{formatHora(tx.fecha)} hs</span>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-lg ${metodo.iconBox}`}>
          <metodo.Icon className="size-5" />
        </div>
      </div>

      {/* Método solicitado */}
      <div>
        <p className="text-[13px] text-muted-foreground">Quiere pagar con</p>
        <p className="text-[17px] font-semibold text-foreground">{metodo.label}</p>
      </div>

      {/* Total box */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-muted px-3.5 py-3">
        {descuento > 0 && (
          <div className="flex items-center justify-between text-xs text-success-foreground">
            <span className="font-medium">Descuento aplicado</span>
            <span className="font-semibold tabular-nums">− {formatPeso(descuento)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-secondary">Total a cobrar</span>
          <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
            {formatPeso(tx.monto)}
          </span>
        </div>
      </div>

      {/* Acciones — stopPropagation evita que el click inicie un drag */}
      <div className="flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <Button size="lg" className="flex-1" onClick={() => onAprobar(tx)}>
          <Check className="size-4" />
          Aprobar cobro
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-auto self-stretch w-11"
          onClick={() => onRechazar(tx)}
          aria-label="Rechazar cobro"
          title="Rechazar y mantener la mesa abierta"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Tarjeta Resuelta (Aprobado / Rechazado) ───────────────────────────── */

export function CobroResueltoCard({ tx }: { tx: TransaccionCobro }) {
  const metodo = metodoInfo(tx.proveedor);
  const aprobado = tx.estado === 'Aprobado';
  const vuelto = (tx.metadata as Record<string, unknown> | null)?.vuelto as number | undefined;

  // Badge de estado
  const statusBg = aprobado ? 'bg-success-subtle' : 'bg-destructive-subtle';
  const statusText = aprobado ? 'text-success-foreground' : 'text-destructive-foreground';
  const statusLabel = aprobado ? 'Aprobado' : 'Rechazado';

  // Texto de detalle al pie
  const horaResuelta = tx.resueltaAt ? formatHora(tx.resueltaAt) : formatHora(tx.fecha);
  let detalle = `${statusLabel} ${horaResuelta}`;
  if (aprobado && vuelto && vuelto > 0) {
    detalle += ` · vuelto ${formatPeso(vuelto)}`;
  }
  if (!aprobado) {
    detalle += ' · la mesa sigue abierta';
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 opacity-75">
      {/* Cabecera: mesa + hora | badge estado */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit rounded-full bg-neutral-subtle px-2 py-0.5 text-xs font-semibold text-text-secondary">
            Mesa {tx.mesaIdentificador}
          </span>
          <span className="text-xs text-muted-foreground">{formatHora(tx.fecha)} hs</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full py-1 pl-2 pr-2.5 text-[11px] font-semibold ${statusBg} ${statusText}`}
        >
          {aprobado ? <Check className="size-3.5" /> : <X className="size-3.5" />}
          {statusLabel}
        </span>
      </div>

      {/* Método */}
      <div className="flex items-center gap-2.5">
        <div className={`flex size-[34px] items-center justify-center rounded-lg ${metodo.iconBox}`}>
          <metodo.Icon className="size-[18px]" />
        </div>
        <span className="text-sm font-semibold text-foreground">{metodo.label}</span>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-secondary">Total</span>
        <span className="font-display text-[19px] font-semibold tabular-nums text-foreground">
          {formatPeso(tx.monto)}
        </span>
      </div>

      {/* Detalle */}
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}
