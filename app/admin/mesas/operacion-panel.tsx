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
        <h3 className="font-bold text-gray-800">{mesa.identificador}</h3>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            mesa.ocupada ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {mesa.ocupada ? 'Ocupada' : 'Libre'}
        </span>
      </div>

      <p className="flex items-center gap-1 text-xs text-gray-500">
        <Users size={12} /> {mesa.capacidad} lugares
      </p>

      {mesa.ocupada && canTakeOrders && (
        <Link
          href={`/admin/mesas/${mesa.id}`}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100"
        >
          <ClipboardList size={15} /> Ver / Agregar pedido
        </Link>
      )}

      {mesa.ocupada && canManage && (
        <button
          onClick={onLiberar}
          disabled={liberando}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
        >
          <DoorOpen size={15} /> {liberando ? 'Liberando...' : 'Liberar mesa'}
        </button>
      )}

      {!mesa.ocupada && canTakeOrders && (
        <button
          onClick={onAbrir}
          disabled={abriendo}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 disabled:opacity-50"
        >
          <ClipboardList size={15} /> {abriendo ? 'Abriendo...' : 'Abrir mesa y tomar pedido'}
        </button>
      )}

      {!mesa.ocupada && (
        <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-md p-2">
          También se abre sola cuando el cliente escanea el QR.
        </p>
      )}

      {/* División de mesas (solo libres) */}
      {canManage && !mesa.ocupada && esSubMesa && (
        <button
          onClick={onUnir}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-100"
        >
          <Combine size={15} /> Volver a unir
        </button>
      )}
      {canManage && !mesa.ocupada && !esSubMesa && mesa.capacidad >= 2 && (
        <button
          onClick={onDividir}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
        >
          <Scissors size={15} /> Dividir mesa
        </button>
      )}

      <div className="pt-2 border-t border-gray-200">
        <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase mb-1">
          <QrCode size={12} /> QR de la comanda
        </label>
        <div className="bg-white p-2 border border-gray-200 rounded-lg flex justify-center">
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
          className="w-full mt-2 text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button onClick={onClose} className="w-full py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100">
        Cerrar
      </button>
    </div>
  );
}
