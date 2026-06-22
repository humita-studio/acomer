'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { type AmbienteUI, type MesaPlano } from './plano-types';

/** Lista plana de mesas (complemento del lienzo en modo operación). */
export function MesaLista({
  mesas,
  ambientes,
  canManage,
  canTakeOrders,
  abriendoId,
  liberandoId,
  onSeleccionar,
  onAbrir,
  onLiberar,
}: {
  mesas: MesaPlano[];
  ambientes: AmbienteUI[];
  canManage: boolean;
  canTakeOrders: boolean;
  abriendoId: string | null;
  liberandoId: string | null;
  onSeleccionar: (mesa: MesaPlano) => void;
  onAbrir: (mesa: MesaPlano) => void;
  onLiberar: (mesa: MesaPlano) => void;
}) {
  const ambNombre = (id: string | null) => ambientes.find((a) => a.id === id)?.nombre ?? '—';

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
        Mesas ({mesas.length})
      </div>
      {mesas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">No hay mesas todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {mesas.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.ocupada ? 'bg-orange-500' : 'bg-green-500'}`}
                title={m.ocupada ? 'Ocupada' : 'Libre'}
              />
              <button onClick={() => onSeleccionar(m)} className="flex-1 min-w-0 text-left">
                <span className="font-medium text-gray-800">{m.identificador}</span>
                <span className="text-xs text-gray-400 ml-2">{ambNombre(m.ambienteId)}</span>
              </button>
              <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Users size={12} /> {m.capacidad}
              </span>
              {m.ocupada && canTakeOrders && (
                <Link
                  href={`/admin/mesas/${m.id}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 shrink-0"
                >
                  Pedido
                </Link>
              )}
              {!m.ocupada && canTakeOrders && (
                <button
                  onClick={() => onAbrir(m)}
                  disabled={abriendoId === m.id}
                  className="text-xs font-bold text-green-700 hover:text-green-900 disabled:opacity-50 shrink-0"
                >
                  {abriendoId === m.id ? '...' : 'Abrir'}
                </button>
              )}
              {m.ocupada && canManage && (
                <button
                  onClick={() => onLiberar(m)}
                  disabled={liberandoId === m.id}
                  className="text-xs font-bold text-orange-600 hover:text-orange-800 disabled:opacity-50 shrink-0"
                >
                  {liberandoId === m.id ? '...' : 'Liberar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
