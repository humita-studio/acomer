'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Ban, Check, Settings, Store, Truck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { cn } from '@/shared/lib/utils';
import {
  getOrdenesExternasAction,
  cambiarEstadoEntregaAction,
} from '@/features/pedidos-online/pedidoExternoActions';
import type { DeliveryConfig } from '@/features/pedidos-online/deliveryConfig';
import { DeliveryConfigSheet } from './DeliveryConfigSheet';

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

// Clases del badge de estado de entrega, con soporte para dark mode.
const ESTADO_BADGE: Record<string, string> = {
  Recibido: 'bg-muted text-muted-foreground',
  EnPreparacion: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Listo: 'bg-primary/10 text-primary',
  EnCamino: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  Entregado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  Cancelado: 'bg-destructive/10 text-destructive',
};

const ESTADO_DOT: Record<string, string> = {
  Recibido: 'bg-muted-foreground',
  EnPreparacion: 'bg-amber-500',
  Listo: 'bg-primary',
  EnCamino: 'bg-purple-500',
  Entregado: 'bg-emerald-500',
  Cancelado: 'bg-destructive',
};

const MODO_LABEL: Record<DeliveryConfig['modo'], string> = {
  ambos: 'delivery y retiro',
  takeaway: 'solo retiro',
  delivery: 'solo envío',
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

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        ESTADO_BADGE[estado] ?? 'bg-muted text-muted-foreground',
      )}
    >
      <span className={cn('size-1.5 rounded-full', ESTADO_DOT[estado] ?? 'bg-muted-foreground')} />
      {LABEL[estado] ?? estado}
    </span>
  );
}

function PagoBadge({ pago }: { pago: Orden['estadoPago'] }) {
  const pagado = pago === 'Pagado';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        pagado
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {pagado ? <Check className="size-3" /> : <Ban className="size-3" />}
      {pagado ? 'Pagado' : 'No pagado'}
    </span>
  );
}

export function PedidosOnlineManager({
  tenantId,
  initialOrdenes,
  initialConfig,
}: {
  tenantId: string;
  initialOrdenes: Orden[];
  initialConfig: DeliveryConfig;
}) {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Orden | null>(null);

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
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.ordenesExternas(tenantId) });
    },
  });

  const activas = ordenes.filter(
    (o) => o.estadoEntrega !== 'Entregado' && o.estadoEntrega !== 'Cancelado',
  );
  const cerradas = ordenes.filter(
    (o) => o.estadoEntrega === 'Entregado' || o.estadoEntrega === 'Cancelado',
  );

  const subtitulo = `${activas.length} en curso · ${cerradas.length} finalizado${
    cerradas.length === 1 ? '' : 's'
  } hoy · ${MODO_LABEL[initialConfig.modo]}`;

  const Card = ({ o }: { o: Orden }) => {
    const next = siguienteEstado(o.estadoEntrega, o.tipo);
    const busy = cambiarEstado.isPending && cambiarEstado.variables?.sesionMesaId === o.sesionMesaId;
    const esEnvio = o.tipo === 'delivery';
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold">{o.nombreContacto}</h3>
            <p className="text-sm text-muted-foreground">{o.telefono}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <EstadoBadge estado={o.estadoEntrega} />
            <PagoBadge pago={o.estadoPago} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {esEnvio ? <Truck className="size-3" /> : <Store className="size-3" />}
            {esEnvio ? 'Envío' : 'Retiro'}
          </span>
          {esEnvio && o.direccion && <span className="truncate">{o.direccion}</span>}
        </div>
        {o.referencia && <p className="-mt-1 text-xs text-muted-foreground">Ref: {o.referencia}</p>}

        {/* Detalle de lo pedido */}
        <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
          {o.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin items.</p>
          ) : (
            o.items.map((it, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold tabular-nums">{it.cantidad}×</span> {it.nombre}
                {it.modificadores.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    ({it.modificadores.join(', ')})
                  </span>
                )}
              </div>
            ))
          )}
          <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">${o.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {next && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => cambiarEstado.mutate({ sesionMesaId: o.sesionMesaId, nuevoEstado: next })}
              disabled={busy}
            >
              {busy ? '…' : LABEL[next]}
              <ArrowRight className="size-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setCancelTarget(o)}
            disabled={busy}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  };

  const FinalizadaCard = ({ o }: { o: Orden }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="min-w-0">
        <h3 className="truncate font-heading font-semibold">{o.nombreContacto}</h3>
        <p className="text-xs text-muted-foreground">
          {o.tipo === 'delivery' ? 'Envío' : 'Retiro'} · {LABEL[o.estadoEntrega] ?? o.estadoEntrega}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <EstadoBadge estado={o.estadoEntrega} />
        <span className="text-sm font-semibold tabular-nums">${o.total.toFixed(2)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toolbar: resumen en vivo + tiempo real + configuración */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            En tiempo real
          </span>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings className="size-4" />
            Configuración
          </Button>
        </div>
      </div>

      {/* En curso */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          En curso
        </h2>
        {activas.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No hay pedidos en curso.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activas.map((o) => (
              <Card key={o.sesionMesaId} o={o} />
            ))}
          </div>
        )}
      </section>

      {/* Finalizados hoy */}
      {cerradas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Finalizados hoy
          </h2>
          <div className="grid grid-cols-1 gap-4 opacity-70 md:grid-cols-2 lg:grid-cols-3">
            {cerradas.map((o) => (
              <FinalizadaCard key={o.sesionMesaId} o={o} />
            ))}
          </div>
        </section>
      )}

      <DeliveryConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        initialConfig={initialConfig}
      />

      {/* Confirmar cancelación */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar el pedido?</DialogTitle>
            <DialogDescription>
              {cancelTarget ? `El pedido de ${cancelTarget.nombreContacto} ` : 'El pedido '}
              se marcará como cancelado y se notificará al cliente. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={cambiarEstado.isPending}
              onClick={() =>
                cancelTarget &&
                cambiarEstado.mutate({
                  sesionMesaId: cancelTarget.sesionMesaId,
                  nuevoEstado: 'Cancelado',
                })
              }
            >
              {cambiarEstado.isPending ? 'Cancelando…' : 'Cancelar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
