'use client';

import { Users } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { type AmbienteUI, type MesaPlano } from './plano-types';

/** Lista plana de mesas (complemento del lienzo en modo operación). */
export function MesaLista({
  mesas,
  ambientes,
  canManage,
  canTakeOrders,
  abriendoId,
  liberandoId,
  mozoLabel,
  onSeleccionar,
  onAbrir,
  onVerPedido,
  onLiberar,
}: {
  mesas: MesaPlano[];
  ambientes: AmbienteUI[];
  canManage: boolean;
  canTakeOrders: boolean;
  abriendoId: string | null;
  liberandoId: string | null;
  mozoLabel?: (userId: string | null | undefined) => string | null;
  onSeleccionar: (mesa: MesaPlano) => void;
  onAbrir: (mesa: MesaPlano) => void;
  onVerPedido: (mesa: MesaPlano) => void;
  onLiberar: (mesa: MesaPlano) => void;
}) {
  const ambNombre = (id: string | null) => ambientes.find((a) => a.id === id)?.nombre ?? '—';

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-secondary-foreground">
        Mesas ({mesas.length})
      </div>
      {mesas.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No hay mesas todavía.</p>
      ) : (
        <ul className="divide-y divide-border">
          {mesas.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
            >
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  m.ocupada ? 'bg-primary' : 'bg-success',
                )}
                title={m.ocupada ? 'Ocupada' : 'Libre'}
              />
              <button type="button" onClick={() => onSeleccionar(m)} className="min-w-0 flex-1 text-left">
                <span className="font-medium text-foreground">{m.identificador}</span>
                <span className="ml-2 text-xs text-muted-foreground">{ambNombre(m.ambienteId)}</span>
                {mozoLabel?.(m.mozoUserId) && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {mozoLabel(m.mozoUserId)}
                  </span>
                )}
              </button>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Users size={12} /> {m.capacidad}
              </span>
              {m.ocupada && canTakeOrders && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto shrink-0 px-0"
                  onClick={() => onVerPedido(m)}
                >
                  Pedido
                </Button>
              )}
              {!m.ocupada && canTakeOrders && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto shrink-0 px-0 text-success-foreground"
                  onClick={() => onAbrir(m)}
                  disabled={abriendoId === m.id}
                >
                  {abriendoId === m.id ? '…' : 'Abrir'}
                </Button>
              )}
              {m.ocupada && canManage && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto shrink-0 px-0 text-primary"
                  onClick={() => onLiberar(m)}
                  disabled={liberandoId === m.id}
                >
                  {liberandoId === m.id ? '…' : 'Liberar'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
