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
    <div className="mt-4 border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-muted border-b border-border text-sm font-semibold text-muted-foreground">
        Mesas ({mesas.length})
      </div>
      {mesas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay mesas todavía.</p>
      ) : (
        <ul className="divide-y divide-border">
          {mesas.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.ocupada ? 'bg-warning' : 'bg-success'}`}
                title={m.ocupada ? 'Ocupada' : 'Libre'}
              />
              <button onClick={() => onSeleccionar(m)} className="flex-1 min-w-0 text-left">
                <span className="font-medium text-foreground">{m.identificador}</span>
                <span className="text-xs text-muted-foreground ml-2">{ambNombre(m.ambienteId)}</span>
              </button>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Users size={12} /> {m.capacidad}
              </span>
              {m.ocupada && canTakeOrders && (
                <Link
                  href={`/admin/mesas/${m.id}`}
                  className="text-xs font-bold text-primary hover:text-primary/80 shrink-0"
                >
                  Pedido
                </Link>
              )}
              {!m.ocupada && canTakeOrders && (
                <button
                  onClick={() => onAbrir(m)}
                  disabled={abriendoId === m.id}
                  className="text-xs font-bold text-success-foreground hover:text-success-foreground disabled:opacity-50 shrink-0"
                >
                  {abriendoId === m.id ? '...' : 'Abrir'}
                </button>
              )}
              {m.ocupada && canManage && (
                <button
                  onClick={() => onLiberar(m)}
                  disabled={liberandoId === m.id}
                  className="text-xs font-bold text-warning-foreground hover:text-warning-foreground disabled:opacity-50 shrink-0"
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
