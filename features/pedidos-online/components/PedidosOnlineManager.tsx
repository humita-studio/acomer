'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import {
  getOrdenesExternasAction,
  cambiarEstadoEntregaAction,
} from '@/features/comanda/pedido-externo-actions';

type OrdenItem = {
  nombre: string;
  cantidad: number;
  modificadores: string[];
};

type Orden = {
  sesionMesaId: string;
  tipo: string;
  estadoSesion: string;
  createdAt: string | Date;
  nombreContacto: string;
  telefono: string;
  direccion: string | null;
  referencia: string | null;
  costoEnvio: string | null;
  estadoEntrega: string;
  horaEstimada: string | Date | null;
  items: OrdenItem[];
  total: number;
  estadoPago: 'Pagado' | 'Pendiente';
};

const LABEL: Record<string, string> = {
  Recibido: 'Recibido',
  EnPreparacion: 'En preparación',
  Listo: 'Listo',
  EnCamino: 'En camino',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
};

const COLOR: Record<string, string> = {
  Recibido: 'bg-gray-100 text-gray-700',
  EnPreparacion: 'bg-amber-100 text-amber-700',
  Listo: 'bg-blue-100 text-blue-700',
  EnCamino: 'bg-purple-100 text-purple-700',
  Entregado: 'bg-green-100 text-green-700',
  Cancelado: 'bg-red-100 text-red-700',
};

// Próximo estado según el flujo y el tipo de pedido.
function siguienteEstado(estado: string, tipo: string): string | null {
  switch (estado) {
    case 'Recibido':
      return 'EnPreparacion';
    case 'EnPreparacion':
      return 'Listo';
    case 'Listo':
      return tipo === 'delivery' ? 'EnCamino' : 'Entregado';
    case 'EnCamino':
      return 'Entregado';
    default:
      return null;
  }
}

export function PedidosOnlineManager({
  tenantId,
  initialOrdenes,
}: {
  tenantId: string;
  initialOrdenes: Orden[];
}) {
  const queryClient = useQueryClient();

  const { data: ordenes = [] } = useQuery({
    queryKey: queryKeys.ordenesExternas(tenantId),
    queryFn: async () => {
      const res = await getOrdenesExternasAction();
      return res.success ? (res.ordenes as Orden[]) : [];
    },
    initialData: initialOrdenes,
  });

  // Realtime: invalidar cuando entra/cambia un pedido externo o cuando se
  // confirma un pago (mesa_pagada / pago_parcial los emite el webhook de MP),
  // para refrescar el estado Pagado/No pagado del tablero al instante.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const invalidar = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ordenesExternas(tenantId) });
    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'orden_externa_nueva' }, invalidar)
      .on('broadcast', { event: 'orden_externa_actualizada' }, invalidar)
      .on('broadcast', { event: 'mesa_pagada' }, invalidar)
      .on('broadcast', { event: 'pago_parcial' }, invalidar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const cambiarEstado = useMutation({
    mutationFn: ({ sesionMesaId, nuevoEstado }: { sesionMesaId: string; nuevoEstado: string }) =>
      cambiarEstadoEntregaAction(sesionMesaId, nuevoEstado as never),
    onSuccess: (res) => {
      if (!res.success) alert(res.message);
      queryClient.invalidateQueries({ queryKey: queryKeys.ordenesExternas(tenantId) });
    },
  });

  const activas = ordenes.filter(
    (o) => o.estadoEntrega !== 'Entregado' && o.estadoEntrega !== 'Cancelado',
  );
  const cerradas = ordenes.filter(
    (o) => o.estadoEntrega === 'Entregado' || o.estadoEntrega === 'Cancelado',
  );

  const Card = ({ o }: { o: Orden }) => {
    const next = siguienteEstado(o.estadoEntrega, o.tipo);
    const cerrada = o.estadoEntrega === 'Entregado' || o.estadoEntrega === 'Cancelado';
    const busy = cambiarEstado.isPending && cambiarEstado.variables?.sesionMesaId === o.sesionMesaId;
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-800">{o.nombreContacto}</h3>
            <p className="text-sm text-gray-500">{o.telefono}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${COLOR[o.estadoEntrega] ?? ''}`}>
              {LABEL[o.estadoEntrega] ?? o.estadoEntrega}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                o.estadoPago === 'Pagado'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {o.estadoPago === 'Pagado' ? '✓ Pagado' : '⏳ No pagado'}
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <span className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs font-medium mr-2">
            {o.tipo === 'delivery' ? '🛵 Envío' : '🏬 Retiro'}
          </span>
          {o.tipo === 'delivery' && o.direccion && <span>{o.direccion}</span>}
        </div>
        {o.referencia && <p className="text-xs text-gray-400">Ref: {o.referencia}</p>}

        {/* Detalle de lo pedido */}
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
          {o.items.length === 0 ? (
            <p className="text-sm text-gray-400">Sin items.</p>
          ) : (
            o.items.map((it, i) => (
              <div key={i} className="text-sm text-gray-700">
                <span className="font-semibold tabular-nums">{it.cantidad}×</span> {it.nombre}
                {it.modificadores.length > 0 && (
                  <span className="text-xs text-gray-400"> ({it.modificadores.join(', ')})</span>
                )}
              </div>
            ))
          )}
          <div className="flex justify-between pt-1 mt-1 border-t border-gray-200 text-sm font-semibold text-gray-800">
            <span>Total</span>
            <span className="tabular-nums">${o.total.toFixed(2)}</span>
          </div>
        </div>

        {!cerrada && (
          <div className="flex flex-wrap gap-2 pt-2">
            {next && (
              <button
                onClick={() => cambiarEstado.mutate({ sesionMesaId: o.sesionMesaId, nuevoEstado: next })}
                disabled={busy}
                className="text-sm bg-blue-600 disabled:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium"
              >
                {busy ? '...' : `→ ${LABEL[next]}`}
              </button>
            )}
            <button
              onClick={() =>
                cambiarEstado.mutate({ sesionMesaId: o.sesionMesaId, nuevoEstado: 'Cancelado' })
              }
              disabled={busy}
              className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {activas.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No hay pedidos en curso.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activas.map((o) => (
            <Card key={o.sesionMesaId} o={o} />
          ))}
        </div>
      )}

      {cerradas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Finalizados (hoy)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {cerradas.map((o) => (
              <Card key={o.sesionMesaId} o={o} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
