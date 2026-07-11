'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  ClipboardList,
  Combine,
  DoorOpen,
  QrCode,
  Scissors,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Separator } from '@/shared/ui/separator';
import { type MesaPlano } from './plano-types';

/** Panel lateral en modo operación: estado, pedido, QR, liberar/abrir/dividir/unir. */
export function OperacionPanel({
  mesa,
  origin,
  canManage,
  canTakeOrders,
  liberando,
  abriendo,
  onLiberar,
  onAbrir,
  onDividir,
  onUnir,
  onClose,
}: {
  mesa: MesaPlano;
  origin: string;
  canManage: boolean;
  canTakeOrders: boolean;
  liberando: boolean;
  abriendo: boolean;
  onLiberar: () => void;
  onAbrir: () => void;
  onDividir: () => void;
  onUnir: () => void;
  onClose: () => void;
}) {
  const url = `${origin}/mesa/${mesa.qrToken}`;
  const esSubMesa = !!mesa.parentMesaId;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {mesa.identificador}
            </h3>
            <Badge
              variant="secondary"
              className={
                mesa.ocupada
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-success-subtle text-success-foreground'
              }
            >
              <span
                className={`mr-1.5 size-1.5 rounded-full ${mesa.ocupada ? 'bg-primary' : 'bg-success'}`}
              />
              {mesa.ocupada ? 'Ocupada' : 'Libre'}
            </Badge>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users size={12} /> {mesa.capacidad} lugares
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar panel">
          <X />
        </Button>
      </div>

      <div className="space-y-2">
        {mesa.ocupada && canTakeOrders && (
          <Button asChild className="w-full" size="lg">
            <Link href={`/admin/mesas/${mesa.id}`}>
              <ClipboardList />
              Ver / Agregar pedido
            </Link>
          </Button>
        )}

        {mesa.ocupada && canManage && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-primary/25 text-primary hover:bg-accent"
            size="lg"
            onClick={onLiberar}
            disabled={liberando}
          >
            <DoorOpen />
            {liberando ? 'Liberando…' : 'Liberar mesa'}
          </Button>
        )}

        {!mesa.ocupada && canTakeOrders && (
          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={onAbrir}
            disabled={abriendo}
          >
            <ClipboardList />
            {abriendo ? 'Abriendo…' : 'Abrir mesa y tomar pedido'}
          </Button>
        )}

        {!mesa.ocupada && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            También se abre sola cuando el cliente escanea el QR.
          </p>
        )}

        {canManage && !mesa.ocupada && esSubMesa && (
          <Button type="button" variant="outline" className="w-full" onClick={onUnir}>
            <Combine />
            Volver a unir
          </Button>
        )}
        {canManage && !mesa.ocupada && !esSubMesa && mesa.capacidad >= 2 && (
          <Button type="button" variant="outline" className="w-full" onClick={onDividir}>
            <Scissors />
            Dividir mesa
          </Button>
        )}
      </div>

      <Separator />

      <div>
        <label className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <QrCode size={12} /> QR de la comanda
        </label>
        <div className="flex justify-center rounded-xl border border-border bg-card p-3">
          <QRCodeSVG value={url} size={140} level="H" />
        </div>
        <input
          type="text"
          readOnly
          value={url}
          onClick={(e) => {
            e.currentTarget.select();
            navigator.clipboard?.writeText(url);
          }}
          title="Clic para copiar"
          className="mt-2 w-full cursor-pointer rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
    </div>
  );
}
