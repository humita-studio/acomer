'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ClipboardList, Combine, DoorOpen, QrCode, Scissors, Users } from 'lucide-react';
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
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-foreground">{mesa.identificador}</h3>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            mesa.ocupada ? 'bg-warning-subtle text-warning-foreground' : 'bg-success-subtle text-success-foreground'
          }`}
        >
          {mesa.ocupada ? 'Ocupada' : 'Libre'}
        </span>
      </div>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users size={12} /> {mesa.capacidad} lugares
      </p>

      {mesa.ocupada && canTakeOrders && (
        <Link
          href={`/admin/mesas/${mesa.id}`}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-primary border border-primary/40 bg-accent hover:bg-accent"
        >
          <ClipboardList size={15} /> Ver / Agregar pedido
        </Link>
      )}

      {mesa.ocupada && canManage && (
        <button
          onClick={onLiberar}
          disabled={liberando}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-warning-foreground border border-warning/40 bg-warning-subtle hover:bg-warning-subtle disabled:opacity-50"
        >
          <DoorOpen size={15} /> {liberando ? 'Liberando...' : 'Liberar mesa'}
        </button>
      )}

      {!mesa.ocupada && canTakeOrders && (
        <button
          onClick={onAbrir}
          disabled={abriendo}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-success-foreground border border-success/40 bg-success-subtle hover:bg-success-subtle disabled:opacity-50"
        >
          <ClipboardList size={15} /> {abriendo ? 'Abriendo...' : 'Abrir mesa y tomar pedido'}
        </button>
      )}

      {!mesa.ocupada && (
        <p className="text-xs text-muted-foreground bg-card border border-border rounded-md p-2">
          También se abre sola cuando el cliente escanea el QR.
        </p>
      )}

      {/* División de mesas (solo libres) */}
      {canManage && !mesa.ocupada && esSubMesa && (
        <button
          onClick={onUnir}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-foreground border border-border bg-card hover:bg-muted"
        >
          <Combine size={15} /> Volver a unir
        </button>
      )}
      {canManage && !mesa.ocupada && !esSubMesa && mesa.capacidad >= 2 && (
        <button
          onClick={onDividir}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-primary border border-primary/40 bg-accent hover:bg-accent"
        >
          <Scissors size={15} /> Dividir mesa
        </button>
      )}

      <div className="pt-2 border-t border-border">
        <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase mb-1">
          <QrCode size={12} /> QR de la comanda
        </label>
        <div className="bg-card p-2 border border-border rounded-lg flex justify-center">
          <QRCodeSVG value={url} size={148} level="H" />
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
          className="w-full mt-2 text-xs text-muted-foreground bg-card border border-border rounded px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <button onClick={onClose} className="w-full py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted">
        Cerrar
      </button>
    </div>
  );
}
