'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ChefHat, Clock, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { formatHora, formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  avanzarPedidoCocinaAction,
  getHistorialCocinaHoyAction,
  getPedidosCocinaAction,
} from '@/features/cocina/cocinaActions';
import {
  COLUMNAS_KDS,
  labelEstadoCocina,
  type EstadoPedidoCocina,
  type PedidoCocina,
} from '@/features/cocina/types';

/** Destinos válidos al soltar una card (mismas reglas que el backend). */
const DROP_VALIDO: Record<string, EstadoPedidoCocina[]> = {
  Pendiente: ['En Preparación', 'Listo'],
  'En Preparación': ['Listo', 'Pendiente'],
  Listo: ['En Preparación', 'Pendiente', 'Entregado'],
};

const COL_COLOR: Record<string, string> = {
  Pendiente: 'bg-warning',
  'En Preparación': 'bg-primary',
  Listo: 'bg-success',
};

function minutosDesde(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function nextEstado(estado: EstadoPedidoCocina): EstadoPedidoCocina | null {
  if (estado === 'Pendiente') return 'En Preparación';
  if (estado === 'En Preparación') return 'Listo';
  if (estado === 'Listo') return 'Entregado';
  return null;
}

function labelAccion(estado: EstadoPedidoCocina): string {
  if (estado === 'Pendiente') return 'Preparar';
  if (estado === 'En Preparación') return 'Listo';
  if (estado === 'Listo') return 'Entregar';
  return 'Avanzar';
}

function esDestinoValido(pedido: PedidoCocina, dest: string): boolean {
  if (pedido.estado === dest) return false;
  return (DROP_VALIDO[pedido.estado] ?? []).includes(dest as EstadoPedidoCocina);
}

/** Aplica el cambio de estado en memoria (sin tocar el server). */
function aplicarEstadoLocal(
  list: PedidoCocina[],
  id: string,
  estado: EstadoPedidoCocina,
): PedidoCocina[] {
  if (estado === 'Entregado') return list.filter((p) => p.id !== id);
  return list.map((p) => (p.id === id ? { ...p, estado } : p));
}

/* ─── Card (contenido visual) ───────────────────────────────────────────── */

function PedidoCardContent({
  pedido,
  onAdvance,
  busy,
  dragHandleProps,
}: {
  pedido: PedidoCocina;
  onAdvance?: (id: string, estado: EstadoPedidoCocina) => void;
  busy?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement> & {
    ref?: React.Ref<HTMLButtonElement>;
  };
}) {
  const mins = minutosDesde(pedido.createdAt);
  const next = nextEstado(pedido.estado);
  const urgente = mins >= 15;

  return (
    <Card
      className={cn(
        'border shadow-sm transition-shadow',
        urgente && 'border-destructive/40 ring-1 ring-destructive/20',
        busy && 'opacity-80',
      )}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            {dragHandleProps && (
              <button
                type="button"
                className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                aria-label="Arrastrar pedido"
                disabled={busy}
                {...dragHandleProps}
              >
                <GripVertical className="size-4" />
              </button>
            )}
            <div className="min-w-0 space-y-1">
              <CardTitle className="truncate text-base font-semibold">
                {pedido.etiquetaOrigen}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatHora(pedido.createdAt)}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    'font-normal',
                    urgente && 'bg-destructive/10 text-destructive',
                  )}
                >
                  {mins} min
                </Badge>
                {pedido.pagado && (
                  <Badge
                    variant="secondary"
                    className="bg-success-subtle font-normal text-success-foreground"
                  >
                    Cobrado
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatPeso(pedido.total)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {pedido.items.map((it) => (
            <li key={it.id} className="leading-snug">
              <span className="font-medium">
                {it.cantidad}× {it.nombre}
              </span>
              {it.modificadores.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {it.modificadores.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
        {pedido.notas && (
          <p className="rounded-md bg-muted/60 px-2 py-1.5 text-xs italic text-muted-foreground">
            {pedido.notas}
          </p>
        )}
        {next && onAdvance && (
          <Button
            className="w-full"
            size="sm"
            disabled={busy}
            onClick={() => onAdvance(pedido.id, next)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : labelAccion(pedido.estado)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Draggable wrapper ─────────────────────────────────────────────────── */

function DraggablePedido({
  pedido,
  onAdvance,
  busy,
}: {
  pedido: PedidoCocina;
  onAdvance: (id: string, estado: EstadoPedidoCocina) => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pedido.id,
    data: { pedido },
    disabled: busy,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'outline-none ring-primary focus-visible:ring-2',
        isDragging && 'opacity-30',
      )}
    >
      <PedidoCardContent
        pedido={pedido}
        onAdvance={onAdvance}
        busy={busy}
        dragHandleProps={{ ...listeners, ...attributes }}
      />
    </div>
  );
}

/* ─── Droppable column ──────────────────────────────────────────────────── */

function BoardColumn({
  estado,
  label,
  description,
  count,
  activePedido,
  children,
}: {
  estado: EstadoPedidoCocina;
  label: string;
  description: string;
  count: number;
  activePedido: PedidoCocina | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  const resaltar =
    isOver && activePedido != null && esDestinoValido(activePedido, estado);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 min-w-[280px] flex-1 flex-col gap-3 rounded-xl bg-muted/50 p-3 transition-colors',
        resaltar && 'bg-primary/5 ring-2 ring-inset ring-primary/50',
        isOver && activePedido && !esDestinoValido(activePedido, estado) && 'opacity-60',
      )}
    >
      <div className="flex shrink-0 items-baseline justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', COL_COLOR[estado] ?? 'bg-muted-foreground')} />
          <div>
            <h2 className="font-semibold leading-none">{label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {/* Solo esta zona scrollea — no la página entera */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-0.5">
        {count === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            {activePedido && resaltar ? 'Soltá acá' : 'Vacío'}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/* ─── Historial del día (solo lectura) ──────────────────────────────────── */

function HistorialHoy({
  pedidos,
  cargando,
}: {
  pedidos: PedidoCocina[];
  cargando: boolean;
}) {
  if (cargando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Cargando historial…
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        Todavía no hay pedidos cerrados hoy
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
      {pedidos.map((p) => (
        <div
          key={p.id}
          className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{p.etiquetaOrigen}</span>
              <Badge variant="secondary" className="font-normal">
                {labelEstadoCocina(p.estado)}
              </Badge>
              {p.pagado && (
                <Badge
                  variant="secondary"
                  className="bg-success-subtle font-normal text-success-foreground"
                >
                  Cobrado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatHora(p.createdAt)} hs · {p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(' · ')}
            </p>
            {p.notas && (
              <p className="text-xs italic text-muted-foreground">{p.notas}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums">{formatPeso(p.total)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Manager ───────────────────────────────────────────────────────────── */

export function CocinaManager({
  initialPedidos,
  tenantId,
}: {
  initialPedidos: PedidoCocina[];
  tenantId: string;
}) {
  const [tab, setTab] = useState<'activos' | 'historial'>('activos');
  const [pedidos, setPedidos] = useState(initialPedidos);
  const [historial, setHistorial] = useState<PedidoCocina[]>([]);
  const [historialCargado, setHistorialCargado] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [activePedido, setActivePedido] = useState<PedidoCocina | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Pedidos con mutación en vuelo: no pisar su estado optimista con un refresh. */
  const inflightRef = useRef<Map<string, PedidoCocina[]>>(new Map());
  const pedidosRef = useRef(pedidos);
  useEffect(() => {
    pedidosRef.current = pedidos;
  }, [pedidos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  /**
   * Merge server → local: si hay mutaciones en vuelo, conserva el estado
   * optimista de esas cards (o las deja fuera si se "entregaron").
   */
  const mergeFromServer = useCallback((server: PedidoCocina[]) => {
    const inflight = inflightRef.current;
    if (inflight.size === 0) {
      setPedidos(server);
      return;
    }

    const byId = new Map(server.map((p) => [p.id, p]));
    // Partimos de lo que el server dice…
    const merged: PedidoCocina[] = [];
    for (const p of server) {
      if (inflight.has(p.id)) {
        // Está en vuelo: preferimos la vista optimista actual.
        const local = pedidosRef.current.find((x) => x.id === p.id);
        if (local) merged.push(local);
        // Si no está en local (Entregado optimista), se omite.
      } else {
        merged.push(p);
      }
    }
    // Cards optimistas que el server todavía no tiene (raro, pero no las perdemos).
    for (const id of inflight.keys()) {
      if (!byId.has(id)) {
        const local = pedidosRef.current.find((x) => x.id === id);
        if (local) merged.push(local);
      }
    }
    setPedidos(merged);
  }, []);

  const refreshActivos = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getPedidosCocinaAction();
      mergeFromServer(data);
    } finally {
      setRefreshing(false);
    }
  }, [mergeFromServer]);

  const refreshHistorial = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getHistorialCocinaHoyAction();
      setHistorial(data);
      setHistorialCargado(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (tab === 'historial') {
      await refreshHistorial();
    } else {
      await refreshActivos();
    }
  }, [tab, refreshActivos, refreshHistorial]);

  // Sync inicial del server component (solo si no hay mutaciones en vuelo).
  useEffect(() => {
    if (inflightRef.current.size === 0) {
      setPedidos(initialPedidos);
    }
  }, [initialPedidos]);

  // Historial bajo demanda al abrir la pestaña.
  useEffect(() => {
    if (tab === 'historial' && !historialCargado) {
      void refreshHistorial();
    }
  }, [tab, historialCargado, refreshHistorial]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'nuevo_pedido' }, () => {
        void refreshActivos();
        if (historialCargado) void refreshHistorial();
      })
      .on('broadcast', { event: 'pedido_estado' }, () => {
        // Si hay mutaciones nuestras en vuelo, el merge las respeta.
        void refreshActivos();
        if (historialCargado) void refreshHistorial();
      })
      .subscribe();

    const poll = setInterval(() => {
      void refreshActivos();
      if (historialCargado) void refreshHistorial();
    }, 30_000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, refreshActivos, refreshHistorial, historialCargado]);

  const porColumna = useMemo(() => {
    const map = new Map<EstadoPedidoCocina, PedidoCocina[]>();
    for (const col of COLUMNAS_KDS) map.set(col.estado, []);
    for (const p of pedidos) {
      const list = map.get(p.estado as EstadoPedidoCocina);
      if (list) list.push(p);
    }
    return map;
  }, [pedidos]);

  /**
   * Update optimista inmediato:
   * 1. Snapshot para rollback
   * 2. Mueve la card en el UI al toque
   * 3. Server action en background
   * 4. Si falla → revierte y toast
   * 5. Si ok → no re-fetch forzado (evita flicker); limpia inflight
   */
  const onAdvance = useCallback((id: string, estado: EstadoPedidoCocina) => {
    if (inflightRef.current.has(id)) return;

    const snapshot = pedidosRef.current;
    inflightRef.current.set(id, snapshot);

    // 1) UI al instante
    setPedidos((list) => aplicarEstadoLocal(list, id, estado));
    setPendingIds((s) => new Set(s).add(id));

    // 2) Persistencia
    void (async () => {
      try {
        const res = await avanzarPedidoCocinaAction(id, estado);
        if (!res.success) {
          toast.error(res.message);
          setPedidos(inflightRef.current.get(id) ?? snapshot);
        } else if (estado === 'Entregado' && historialCargado) {
          // El pedido salió del KDS: refrescar historial si ya se cargó.
          void refreshHistorial();
        }
        // Éxito: dejamos el estado optimista. El realtime/poll confirma después.
      } catch {
        toast.error('No se pudo actualizar el pedido');
        setPedidos(inflightRef.current.get(id) ?? snapshot);
      } finally {
        inflightRef.current.delete(id);
        setPendingIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    })();
  }, [historialCargado, refreshHistorial]);

  const handleDragStart = (event: DragStartEvent) => {
    const pedido = event.active.data.current?.pedido as PedidoCocina | undefined;
    setActivePedido(pedido ?? pedidosRef.current.find((p) => p.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const pedido =
      (event.active.data.current?.pedido as PedidoCocina | undefined) ??
      pedidosRef.current.find((p) => p.id === event.active.id) ??
      null;
    const overId = event.over?.id ? String(event.over.id) : null;

    // Importante: primero el update optimista, después soltar el overlay
    // (así la card ya aparece en la columna destino al mismo frame).
    if (pedido && overId && esDestinoValido(pedido, overId)) {
      onAdvance(pedido.id, overId as EstadoPedidoCocina);
    } else if (pedido && overId && overId !== pedido.estado) {
      toast.error('Ese cambio de estado no está permitido');
    }

    setActivePedido(null);
  };

  const totalActivos = pedidos.length;

  return (
    // Altura = viewport − header admin − padding del main (mismo truco que cobros).
    <div className="flex h-[calc(100svh-6.5rem)] flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display flex items-center gap-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            <ChefHat className="size-8 text-primary" />
            Cocina
          </h1>
          <p className="text-sm text-muted-foreground">
            {tab === 'historial'
              ? 'Pedidos cerrados de hoy'
              : totalActivos === 0
                ? 'Sin pedidos activos de hoy'
                : `${totalActivos} pedido${totalActivos === 1 ? '' : 's'} de hoy · arrastrá o usá el botón`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={refreshing || (tab === 'activos' && pendingIds.size > 0)}
        >
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : 'Actualizar'}
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v === 'historial' ? 'historial' : 'activos')}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList className="shrink-0">
          <TabsTrigger value="activos">
            En curso
            {totalActivos > 0 && (
              <Badge variant="secondary" className="ml-0.5 font-normal">
                {totalActivos}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial de hoy</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="mt-0 flex min-h-0 flex-1 flex-col outline-none">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActivePedido(null)}
          >
            <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto">
              {COLUMNAS_KDS.map((col) => {
                const lista = porColumna.get(col.estado) ?? [];
                return (
                  <BoardColumn
                    key={col.estado}
                    estado={col.estado}
                    label={col.label}
                    description={col.description}
                    count={lista.length}
                    activePedido={activePedido}
                  >
                    {lista.map((p) => (
                      <DraggablePedido
                        key={p.id}
                        pedido={p}
                        onAdvance={onAdvance}
                        busy={pendingIds.has(p.id)}
                      />
                    ))}
                  </BoardColumn>
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activePedido ? (
                <div className="w-[min(100vw-2rem,340px)] rotate-1 cursor-grabbing shadow-xl">
                  <PedidoCardContent pedido={activePedido} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="historial" className="mt-0 flex min-h-0 flex-1 flex-col outline-none">
          <HistorialHoy pedidos={historial} cargando={refreshing && !historialCargado} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
