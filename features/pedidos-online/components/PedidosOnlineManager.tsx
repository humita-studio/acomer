'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ArrowRight,
  Ban,
  Check,
  Clock,
  Copy,
  CheckCheck,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Settings,
  Store,
  Truck,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
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

// Color del punto del encabezado de cada columna (alineado con el flujo del pedido).
const ESTADO_DOT: Record<string, string> = {
  Recibido: 'bg-muted-foreground',
  EnPreparacion: 'bg-warning',
  Listo: 'bg-primary',
  EnCamino: 'bg-purple-500',
  Entregado: 'bg-success',
};

const MODO_LABEL: Record<DeliveryConfig['modo'], string> = {
  ambos: 'delivery y retiro',
  takeaway: 'solo retiro',
  delivery: 'solo envío',
};

// Columnas del tablero, en orden del flujo. Cancelado vive aparte (chip + popover).
const COLUMNAS = [
  { estado: 'Recibido', label: 'Recibido' },
  { estado: 'EnPreparacion', label: 'En preparación' },
  { estado: 'Listo', label: 'Listo' },
  { estado: 'EnCamino', label: 'En camino' },
  { estado: 'Entregado', label: 'Entregado' },
] as const;

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'delivery', label: 'Envío' },
  { value: 'takeaway', label: 'Retiro' },
] as const;
type Filtro = (typeof FILTROS)[number]['value'];

// Próximo estado según el flujo y el tipo de pedido (acción "Marcar como…").
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

// Se puede soltar la tarjeta en esa columna: no es la misma y, si es retiro, no
// va a "En camino" (esa etapa es solo para delivery).
function esTransicionValida(orden: Orden, destino: string): boolean {
  if (orden.estadoEntrega === destino) return false;
  if (destino === 'EnCamino' && orden.tipo !== 'delivery') return false;
  return true;
}

// "hace X min" relativo a `ahora` (ms), para el pie de cada tarjeta del tablero.
function tiempoRelativo(desde: string | Date, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function PagoChip({ pagado }: { pagado: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        pagado ? 'bg-success-subtle text-success-foreground' : 'bg-destructive/10 text-destructive',
      )}
    >
      <span className={cn('size-1.5 rounded-full', pagado ? 'bg-success-foreground' : 'bg-destructive')} />
      {pagado ? 'Pagado' : 'No pagado'}
    </span>
  );
}

function TipoChip({ esEnvio }: { esEnvio: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {esEnvio ? <Truck className="size-3" /> : <Store className="size-3" />}
      {esEnvio ? 'Envío' : 'Retiro'}
    </span>
  );
}

// Cuerpo (sin drag) de una tarjeta en curso — reutilizado por la columna y el overlay.
function OrdenCardBody({
  orden,
  now,
  onAdvance,
  onCancel,
}: {
  orden: Orden;
  now: number;
  onAdvance: (sesionMesaId: string, nuevoEstado: string) => void;
  onCancel: (orden: Orden) => void;
}) {
  const next = siguienteEstado(orden.estadoEntrega, orden.tipo);
  const esEnvio = orden.tipo === 'delivery';
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold leading-tight">{orden.nombreContacto}</h3>
        <p className="truncate text-xs text-muted-foreground">{orden.telefono}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <TipoChip esEnvio={esEnvio} />
        <PagoChip pagado={orden.estadoPago === 'Pagado'} />
      </div>

      {esEnvio && orden.direccion && (
        <p className="text-[11px] text-muted-foreground">
          {orden.direccion}
          {orden.referencia ? ` · ${orden.referencia}` : ''}
        </p>
      )}

      <div className="flex flex-col gap-1 rounded-md bg-muted p-2">
        {orden.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin items.</p>
        ) : (
          orden.items.map((it, i) => (
            <div key={i} className="flex gap-1.5 text-xs">
              <span className="font-semibold tabular-nums text-foreground">{it.cantidad}×</span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                {it.nombre}
                {it.modificadores.length > 0 && (
                  <span className="text-[11px]"> ({it.modificadores.join(', ')})</span>
                )}
              </span>
            </div>
          ))
        )}
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total</span>
          <span className="font-display text-[15px] font-semibold tabular-nums">
            ${orden.total.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {tiempoRelativo(orden.createdAt, now)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Acciones del pedido"
              // Evita que el sensor de arrastre tome el click sobre el menú.
              onPointerDown={(e) => e.stopPropagation()}
              className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {next && (
              <>
                <DropdownMenuItem onClick={() => onAdvance(orden.sesionMesaId, next)}>
                  <ArrowRight className="size-4" />
                  Marcar como {LABEL[next].toLowerCase()}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => onCancel(orden)}>
              <Ban className="size-4" />
              Cancelar pedido
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Cuerpo compacto (sin drag) de un pedido entregado.
function EntregadoCardBody({ orden }: { orden: Orden }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-card-foreground opacity-75">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold">{orden.nombreContacto}</h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success-foreground">
          <Check className="size-3" />
          Entregado
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {orden.tipo === 'delivery' ? 'Envío' : 'Retiro'} · entregado
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Total</span>
        <span className="font-display text-[15px] font-semibold tabular-nums">
          ${orden.total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// Envoltorio arrastrable. El cuerpo original se atenúa mientras se arrastra; el
// clon que sigue al cursor lo dibuja el <DragOverlay> (sin recortarse al cruzar
// columnas).
function DraggableCard({
  orden,
  highlighted,
  children,
}: {
  orden: Orden;
  highlighted?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: orden.sesionMesaId,
    data: { orden },
  });
  return (
    <div
      id={`orden-${orden.sesionMesaId}`}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'touch-none cursor-grab rounded-lg outline-none ring-primary focus-visible:ring-2 active:cursor-grabbing',
        isDragging && 'opacity-30',
        highlighted && 'ring-2 ring-primary shadow-md',
      )}
    >
      {children}
    </div>
  );
}

function Columna({
  estado,
  label,
  items,
  now,
  activeOrden,
  highlightSesionId,
  onAdvance,
  onCancel,
}: {
  estado: string;
  label: string;
  items: Orden[];
  now: number;
  activeOrden: Orden | null;
  highlightSesionId?: string | null;
  onAdvance: (sesionMesaId: string, nuevoEstado: string) => void;
  onCancel: (orden: Orden) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  const esEntregado = estado === 'Entregado';
  const resaltar = isOver && activeOrden != null && esTransicionValida(activeOrden, estado);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full w-[264px] shrink-0 flex-col gap-2.5 rounded-xl bg-muted/60 p-2.5 transition-colors',
        resaltar && 'bg-primary/5 ring-2 ring-inset ring-primary/50',
      )}
    >
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', ESTADO_DOT[estado] ?? 'bg-muted-foreground')} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {items.length}
        </span>
      </div>
      {/* Solo scrollea la lista de tarjetas, no la página. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin pedidos</p>
        ) : (
          items.map((o) => (
            <DraggableCard
              key={o.sesionMesaId}
              orden={o}
              highlighted={highlightSesionId === o.sesionMesaId}
            >
              {esEntregado ? (
                <EntregadoCardBody orden={o} />
              ) : (
                <OrdenCardBody orden={o} now={now} onAdvance={onAdvance} onCancel={onCancel} />
              )}
            </DraggableCard>
          ))
        )}
      </div>
    </div>
  );
}

/** Beep corto para avisar un pedido nuevo (sin asset externo). */
function beepNuevoPedido() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // autoplay / permisos
  }
}

export function PedidosOnlineManager({
  tenantId,
  initialOrdenes,
  initialConfig,
  publicPedirUrl,
  direccionLocal,
}: {
  tenantId: string;
  initialOrdenes: Orden[];
  initialConfig: DeliveryConfig;
  /** URL pública del menú online del local (para copiar / abrir). */
  publicPedirUrl?: string;
  /** Dirección del local (landing) para centrar el mapa de zona. */
  direccionLocal?: string;
}) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlightSesionId = searchParams.get('sesion');
  const ordenesKey = queryKeys.ordenesExternas(tenantId);
  const [configOpen, setConfigOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Orden | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [activeOrden, setActiveOrden] = useState<Orden | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [flashNuevo, setFlashNuevo] = useState(false);

  // Tick para refrescar los "hace X min" sin esperar a un evento realtime.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: ordenes = [] } = useQuery({
    queryKey: ordenesKey,
    queryFn: async () => {
      const res = await getOrdenesExternasAction();
      return res.success ? (res.ordenes as Orden[]) : [];
    },
    initialData: initialOrdenes,
  });

  // Llegada desde el buscador del admin (?sesion=): scrollea hasta la tarjeta resaltada.
  useEffect(() => {
    if (!highlightSesionId) return;
    if (!ordenes.some((o) => o.sesionMesaId === highlightSesionId)) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`orden-${highlightSesionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [highlightSesionId, ordenes]);

  // Realtime: invalidar cuando entra/cambia un pedido externo o cuando se
  // confirma un pago (mesa_pagada / pago_parcial los emite el webhook de MP),
  // para refrescar el estado Pagado/No pagado del tablero al instante.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const invalidar = () => queryClient.invalidateQueries({ queryKey: ordenesKey });
    const onNueva = () => {
      invalidar();
      beepNuevoPedido();
      setFlashNuevo(true);
      window.setTimeout(() => setFlashNuevo(false), 4000);
      toast.message('Nuevo pedido online', {
        description: 'Revisá la columna Recibido',
        duration: 8000,
      });
    };
    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'orden_externa_nueva' }, onNueva)
      .on('broadcast', { event: 'orden_externa_actualizada' }, invalidar)
      .on('broadcast', { event: 'mesa_pagada' }, invalidar)
      .on('broadcast', { event: 'pago_parcial' }, invalidar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, ordenesKey]);

  const copiarLinkPublico = async () => {
    if (!publicPedirUrl) return;
    try {
      await navigator.clipboard.writeText(publicPedirUrl);
      setLinkCopiado(true);
      toast.success('Link copiado');
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  // Cambia el estado de entrega con update optimista (el arrastre y el menú se
  // ven al instante; realtime/refetch reconcilian al confirmar el server).
  const cambiarEstado = useMutation({
    mutationFn: ({ sesionMesaId, nuevoEstado }: { sesionMesaId: string; nuevoEstado: string }) =>
      cambiarEstadoEntregaAction(sesionMesaId, nuevoEstado as never),
    onMutate: async ({ sesionMesaId, nuevoEstado }) => {
      setCancelTarget(null);
      await queryClient.cancelQueries({ queryKey: ordenesKey });
      const prev = queryClient.getQueryData<Orden[]>(ordenesKey);
      queryClient.setQueryData<Orden[]>(ordenesKey, (old = []) =>
        old.map((o) => (o.sesionMesaId === sesionMesaId ? { ...o, estadoEntrega: nuevoEstado } : o)),
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ordenesKey, ctx.prev);
      toast.error('No se pudo actualizar el pedido.');
    },
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || 'No se pudo actualizar el pedido.');
        return;
      }
      toast.success('Pedido actualizado');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordenesKey });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    setActiveOrden((e.active.data.current?.orden as Orden | undefined) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const orden = e.active.data.current?.orden as Orden | undefined;
    setActiveOrden(null);
    const destino = e.over ? String(e.over.id) : null;
    if (!orden || !destino || !esTransicionValida(orden, destino)) return;
    cambiarEstado.mutate({ sesionMesaId: orden.sesionMesaId, nuevoEstado: destino });
  };

  const advance = (sesionMesaId: string, nuevoEstado: string) =>
    cambiarEstado.mutate({ sesionMesaId, nuevoEstado });

  const visibles = filtro === 'todos' ? ordenes : ordenes.filter((o) => o.tipo === filtro);
  const porEstado = (estado: string) => visibles.filter((o) => o.estadoEntrega === estado);
  const cancelados = visibles.filter((o) => o.estadoEntrega === 'Cancelado');

  const activas = ordenes.filter(
    (o) => o.estadoEntrega !== 'Entregado' && o.estadoEntrega !== 'Cancelado',
  );
  const cerradas = ordenes.filter(
    (o) => o.estadoEntrega === 'Entregado' || o.estadoEntrega === 'Cancelado',
  );
  const subtitulo = `${activas.length} en curso · ${cerradas.length} finalizado${
    cerradas.length === 1 ? '' : 's'
  } hoy · ${MODO_LABEL[initialConfig.modo]}`;

  const sinPedidosHoy = ordenes.length === 0;

  return (
    // Alto acotado al viewport para que scrolleen las columnas y no la página.
    // El shell admin usa min-h-svh (no fija altura), así que h-full no resuelve;
    // descontamos el topbar (h-14 = 3.5rem) y el padding del <main> (p-6 = 3rem).
    <div className="flex h-[calc(100svh-6.5rem)] flex-col gap-6">
      {/* Encabezado: título + resumen en vivo + estado realtime */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Pedidos online</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            flashNuevo
              ? 'bg-primary text-primary-foreground'
              : 'bg-success-subtle text-success-foreground',
          )}
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                flashNuevo ? 'bg-primary-foreground' : 'bg-success',
              )}
            />
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                flashNuevo ? 'bg-primary-foreground' : 'bg-success-foreground',
              )}
            />
          </span>
          {flashNuevo ? '¡Pedido nuevo!' : 'En tiempo real'}
        </span>
      </div>

      {!initialConfig.activo ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
          <p>
            Los pedidos online están <strong>apagados</strong>. La página pública no toma pedidos.
          </p>
          <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
            Activar
          </Button>
        </div>
      ) : null}

      {sinPedidosHoy && initialConfig.activo ? (
        <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-dashed bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Todavía no hay pedidos online hoy</p>
            <p className="text-sm text-muted-foreground">
              Compartí el link del menú con tus clientes. Los pedidos aparecen acá y en cocina.
            </p>
            {publicPedirUrl ? (
              <p className="truncate font-mono text-xs text-muted-foreground">{publicPedirUrl}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {publicPedirUrl ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void copiarLinkPublico()}>
                  {linkCopiado ? (
                    <>
                      <CheckCheck className="size-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar link
                    </>
                  )}
                </Button>
                <Button type="button" size="sm" asChild>
                  <a href={publicPedirUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                    Abrir menú
                  </a>
                </Button>
              </>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings className="size-4" />
              Configurar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Toolbar: filtro por modalidad + cancelados + configuración */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                filtro === f.value
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {publicPedirUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void copiarLinkPublico()}>
              {linkCopiado ? <CheckCheck className="size-4" /> : <Link2 className="size-4" />}
              {linkCopiado ? 'Link copiado' : 'Link del menú'}
            </Button>
          ) : null}
          {cancelados.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="size-1.5 rounded-full bg-destructive" />
                  Cancelados · {cancelados.length}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cancelados
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {cancelados.map((o) => (
                    <div
                      key={o.sesionMesaId}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.nombreContacto}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.tipo === 'delivery' ? 'Envío' : 'Retiro'} ·{' '}
                          {tiempoRelativo(o.createdAt, now)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        ${o.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings className="size-4" />
            Configuración
          </Button>
        </div>
      </div>

      {/* Tablero kanban con arrastre entre columnas */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveOrden(null)}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {COLUMNAS.map((c) => (
            <Columna
              key={c.estado}
              estado={c.estado}
              label={c.label}
              items={porEstado(c.estado)}
              now={now}
              activeOrden={activeOrden}
              highlightSesionId={highlightSesionId}
              onAdvance={advance}
              onCancel={setCancelTarget}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeOrden ? (
            <div className="w-[244px] rotate-2 cursor-grabbing shadow-xl">
              {activeOrden.estadoEntrega === 'Entregado' ? (
                <EntregadoCardBody orden={activeOrden} />
              ) : (
                <OrdenCardBody orden={activeOrden} now={now} onAdvance={() => {}} onCancel={() => {}} />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DeliveryConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        initialConfig={initialConfig}
        publicPedirUrl={publicPedirUrl}
        direccionLocal={direccionLocal}
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
