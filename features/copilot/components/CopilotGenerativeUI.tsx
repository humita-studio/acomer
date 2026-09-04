'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  Bike,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Flame,
  LayoutGrid,
  PauseCircle,
  Percent,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

export function ToolInvocationRenderer({
  toolName,
  state,
  args,
  result,
}: {
  toolName: string;
  state?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}) {
  const isPending = state === 'call' || state === 'input-streaming' || !result;

  if (isPending) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground animate-pulse">
        <Wrench className="size-3.5 text-primary animate-spin" />
        <span>Consultando {toolName}…</span>
      </div>
    );
  }

  // Card para Métricas del Día
  if (toolName === 'consultarMetricasDelDia' && result && typeof result === 'object') {
    const data = result as {
      periodo?: string;
      totalFacturado?: number;
      cantidadCobros?: number;
      ticketPromedio?: number;
      totalPedidos?: number;
      desglosePorCanal?: Record<string, number>;
    };

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Ventas y Rendimiento ({data.periodo === 'semana' ? 'Últimos 7 días' : 'Hoy'})</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            {data.cantidadCobros ?? 0} cobros
          </Badge>
        </div>

        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground">
            {formatPeso(data.totalFacturado ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ticket promedio: <span className="font-semibold text-foreground">{formatPeso(data.ticketPromedio ?? 0)}</span>
          </p>
        </div>

        {data.desglosePorCanal && Object.keys(data.desglosePorCanal).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(data.desglosePorCanal).map(([canal, cant]) => (
              <span
                key={canal}
                className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground capitalize"
              >
                {canal}: <strong className="font-semibold">{cant}</strong>
              </span>
            ))}
          </div>
        )}

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/reportes">
              <span>Ver reporte detallado</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Estado del Salón
  if (toolName === 'consultarEstadoSalon' && result && typeof result === 'object') {
    const data = result as {
      totalMesas?: number;
      ocupadas?: number;
      libres?: number;
      porcentajeOcupacion?: number;
      mesas?: Array<{ mesa: string; estado: string; minutosOcupada?: number }>;
    };

    const ocupadas = data.mesas?.filter((m) => m.estado === 'Ocupada') ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <LayoutGrid className="size-4 text-primary" />
            <span>Ocupación de Salón</span>
          </div>
          <Badge
            variant={data.porcentajeOcupacion && data.porcentajeOcupacion > 70 ? 'destructive' : 'secondary'}
            className="text-[10px]"
          >
            {data.porcentajeOcupacion ?? 0}% ocupado
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, data.porcentajeOcupacion ?? 0)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {data.ocupadas ?? 0} de {data.totalMesas ?? 0} mesas
          </span>
        </div>

        {ocupadas.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] font-medium text-muted-foreground">Mesas con comensales:</p>
            <div className="flex flex-wrap gap-1.5">
              {ocupadas.slice(0, 6).map((m) => (
                <span
                  key={m.mesa}
                  className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-300"
                >
                  {m.mesa} ({m.minutosOcupada ?? 0} min)
                </span>
              ))}
              {ocupadas.length > 6 && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  +{ocupadas.length - 6} más
                </span>
              )}
            </div>
          </div>
        )}

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/mesas">
              <span>Abrir plano de mesas</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Estado de Caja
  if (toolName === 'consultarEstadoCaja' && result && typeof result === 'object') {
    const data = result as {
      cajaAbierta?: boolean;
      mensaje?: string;
      montoInicial?: number;
      ventasEfectivo?: number;
      totalEsperadoEnEfectivo?: number;
    };

    if (!data.cajaAbierta) {
      return (
        <div className="my-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between">
          <span>La caja se encuentra cerrada actualmente.</span>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href="/admin/caja">Abrir caja</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Arqueo de Caja (Turno Abierto)</span>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
            Abierta
          </Badge>
        </div>

        <div>
          <p className="text-[11px] text-muted-foreground uppercase font-medium">Efectivo esperado en mano</p>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatPeso(data.totalEsperadoEnEfectivo ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fondo inicial: {formatPeso(data.montoInicial ?? 0)} · Ventas efvo: {formatPeso(data.ventasEfectivo ?? 0)}
          </p>
        </div>

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/caja">
              <span>Gestionar movimientos de caja</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Platos Más Vendidos
  if (toolName === 'consultarPlatosMasVendidos' && result && typeof result === 'object') {
    const data = result as {
      platosMasVendidos?: Array<{ nombre: string; cantidadTotal: number }>;
    };

    const lista = data.platosMasVendidos ?? [];
    const medallas = ['🥇', '🥈', '🥉'];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Flame className="size-4 text-orange-500" />
            <span>Platos Más Pedidos (Últimos 7 días)</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {lista.slice(0, 5).map((plato, idx) => (
            <div key={plato.nombre} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{medallas[idx] ?? `${idx + 1}.`}</span>
                <span className="font-medium text-foreground truncate">{plato.nombre}</span>
              </div>
              <Badge variant="secondary" className="text-[11px] font-mono shrink-0">
                {plato.cantidadTotal} un.
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card para Pausar / Activar Plato
  if (toolName === 'pausarOActivarPlato' && result && typeof result === 'object') {
    const data = result as {
      exito?: boolean;
      nombreReal?: string;
      nuevoEstado?: string;
      mensaje?: string;
    };

    const isActivo = data.nuevoEstado?.toLowerCase().includes('activo');

    return (
      <div
        className={`my-2 rounded-xl border p-3 text-xs shadow-xs space-y-1.5 ${
          isActivo
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {isActivo ? (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <PauseCircle className="size-4 text-amber-600 dark:text-amber-400" />
          )}
          <span>{data.mensaje}</span>
        </div>
      </div>
    );
  }

  // Card para Búsqueda de Platos
  if (toolName === 'buscarPlatosEnCarta' && result && typeof result === 'object') {
    const data = result as {
      resultados?: Array<{ id: string; nombre: string; precio: number; activo: boolean }>;
    };

    const platos = data.resultados ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3 shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground border-b pb-1.5">
          <UtensilsCrossed className="size-3.5 text-primary" />
          <span>Platos encontrados en carta</span>
        </div>
        <div className="space-y-1">
          {platos.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs py-1">
              <span className="font-medium truncate mr-2">{p.nombre}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-foreground">{formatPeso(p.precio)}</span>
                <Badge variant={p.activo ? 'outline' : 'secondary'} className="text-[10px]">
                  {p.activo ? 'Disponible' : 'Pausado'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card para Cocina / KDS en Vivo
  if (toolName === 'consultarEstadoCocina' && result && typeof result === 'object') {
    const data = result as {
      totalActivos?: number;
      pendientes?: number;
      enPreparacion?: number;
      listos?: number;
      demoradosCount?: number;
      platosEnMarcha?: Array<{ plato: string; cantidad: number }>;
      pedidos?: Array<{
        id: string;
        origen: string;
        estado: string;
        minutos: number;
        demorado: boolean;
        notas?: string | null;
        total: number;
      }>;
    };

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <UtensilsCrossed className="size-4 text-orange-600 dark:text-orange-400" />
            <span>Monitor KDS de Cocina</span>
          </div>
          <Badge
            variant={data.demoradosCount && data.demoradosCount > 0 ? 'destructive' : 'secondary'}
            className="text-[10px]"
          >
            {data.totalActivos ?? 0} pedidos activos
          </Badge>
        </div>

        {data.demoradosCount && data.demoradosCount > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-900 dark:text-red-300">
            <AlertTriangle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
            <span>¡Atención! {data.demoradosCount} comanda(s) demorada(s) más de 20 min.</span>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="rounded-lg bg-muted/60 p-1.5">
            <span className="block text-[10px] text-muted-foreground">Nuevos</span>
            <span className="font-bold text-foreground">{data.pendientes ?? 0}</span>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-900 dark:text-amber-300">
            <span className="block text-[10px] opacity-80">En prep.</span>
            <span className="font-bold">{data.enPreparacion ?? 0}</span>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-900 dark:text-emerald-300">
            <span className="block text-[10px] opacity-80">Listos</span>
            <span className="font-bold">{data.listos ?? 0}</span>
          </div>
        </div>

        {data.platosEnMarcha && data.platosEnMarcha.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] font-medium text-muted-foreground">Marchando ahora mismo:</p>
            <div className="flex flex-wrap gap-1">
              {data.platosEnMarcha.slice(0, 5).map((item) => (
                <span
                  key={item.plato}
                  className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                >
                  {item.cantidad}x {item.plato}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/cocina">
              <span>Abrir monitor de cocina</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Pedidos Delivery / Online
  if (toolName === 'consultarPedidosDelivery' && result && typeof result === 'object') {
    const data = result as {
      totalPedidosHoy?: number;
      activosCount?: number;
      entregadosCount?: number;
      canceladosCount?: number;
      pedidos?: Array<{
        id: string;
        cliente: string;
        telefono: string;
        direccion: string;
        tipo: string;
        estado: string;
        costoEnvio: number;
        minutosDesdePedido: number;
        horaEstimada?: string;
      }>;
    };

    const pedidos = data.pedidos ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Bike className="size-4 text-sky-600 dark:text-sky-400" />
            <span>Delivery y Takeaway</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.activosCount ?? 0} en curso / {data.totalPedidosHoy ?? 0} hoy
          </Badge>
        </div>

        {pedidos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No hay pedidos online activos en este momento.</p>
        ) : (
          <div className="space-y-1.5">
            {pedidos.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-foreground truncate">{p.cliente}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.direccion}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {p.estado}
                  </Badge>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">{p.minutosDesdePedido} min</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/pedidos-online">
              <span>Gestionar pedidos online</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Reservas
  if (toolName === 'consultarReservas' && result && typeof result === 'object') {
    const data = result as {
      dia?: string;
      totalReservas?: number;
      totalComensales?: number;
      confirmadas?: number;
      pendientes?: number;
      sentadas?: number;
      reservas?: Array<{
        id: string;
        hora: string;
        nombre: string;
        personas: number;
        mesa: string;
        telefono: string;
        estado: string;
      }>;
    };

    const lista = data.reservas ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <CalendarCheck className="size-4 text-violet-600 dark:text-violet-400" />
            <span>Agenda de Reservas ({data.dia ?? 'Hoy'})</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.totalComensales ?? 0} comensales
          </Badge>
        </div>

        {lista.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No hay reservas registradas para esta jornada.</p>
        ) : (
          <div className="space-y-1.5">
            {lista.slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-foreground text-xs">{r.hora}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">{r.personas} pers. · Mesa {r.mesa}</p>
                  </div>
                </div>
                <Badge
                  variant={r.estado === 'Confirmada' ? 'secondary' : r.estado === 'Sentada' ? 'default' : 'outline'}
                  className="text-[10px] shrink-0"
                >
                  {r.estado}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/reservas">
              <span>Ver calendario de reservas</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Reseñas y Satisfacción de Clientes
  if (toolName === 'consultarResenasClientes' && result && typeof result === 'object') {
    const data = result as {
      totalResenas?: number;
      promedioEstrellas?: number;
      criticasNuevas?: number;
      distribucion?: Record<number, number>;
      resenas?: Array<{
        id: string;
        estrellas: number;
        comentario: string;
        cliente: string;
        fecha: string;
        estado: string;
      }>;
    };

    const opiniones = data.resenas ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Star className="size-4 fill-amber-400 text-amber-500" />
            <span>Satisfacción de Clientes</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            ⭐ {data.promedioEstrellas?.toFixed(1) ?? '0.0'} / 5.0 ({data.totalResenas ?? 0})
          </Badge>
        </div>

        {data.criticasNuevas && data.criticasNuevas > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
            <span>{data.criticasNuevas} reseña(s) de ≤3★ requieren atención.</span>
          </div>
        ) : null}

        {opiniones.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {opiniones.slice(0, 3).map((op) => (
              <div key={op.id} className="rounded-lg bg-muted/40 p-2 text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-foreground">{op.cliente}</span>
                  <span className="text-amber-500 font-mono">{'★'.repeat(op.estrellas)}{'☆'.repeat(5 - op.estrellas)}</span>
                </div>
                <p className="text-muted-foreground text-[11px] italic line-clamp-2">
                  &ldquo;{op.comentario}&rdquo;
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/resenas">
              <span>Gestionar opiniones</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Desglose de Métodos de Pago
  if (toolName === 'consultarDesgloseMetodosPago' && result && typeof result === 'object') {
    const data = result as {
      periodo?: string;
      totalRecaudado?: number;
      totalTransacciones?: number;
      metodos?: Array<{
        codigo: string;
        nombre: string;
        total: number;
        cantidad: number;
        porcentaje: number;
      }>;
    };

    const metodos = data.metodos ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Desglose por Método de Pago</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.totalTransacciones ?? 0} pagos
          </Badge>
        </div>

        <div>
          <span className="text-[11px] text-muted-foreground uppercase">Total Cobrado</span>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatPeso(data.totalRecaudado ?? 0)}
          </p>
        </div>

        <div className="space-y-1.5 pt-1">
          {metodos.map((m) => (
            <div key={m.codigo} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{m.nombre}</span>
                <span className="text-[10px] text-muted-foreground">({m.cantidad})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{formatPeso(m.total)}</span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {m.porcentaje}%
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-1">
          <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary">
            <Link href="/admin/reportes">
              <span>Ver reporte de caja y cobros</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Card para Actualización de Precio Individual
  if (toolName === 'actualizarPrecioPlato' && result && typeof result === 'object') {
    const data = result as {
      exito?: boolean;
      nombre?: string;
      precioAnterior?: number;
      nuevoPrecio?: number;
      mensaje?: string;
    };

    if (!data.exito) {
      return (
        <div className="my-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-900 dark:text-red-300">
          {data.mensaje}
        </div>
      );
    }

    return (
      <div className="my-2 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Precio Actualizado</span>
          </div>
          <Badge className="bg-emerald-600 text-white text-[10px]">Guardado</Badge>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-foreground text-xs">{data.nombre}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground line-through text-xs">
              {formatPeso(data.precioAnterior ?? 0)}
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
              {formatPeso(data.nuevoPrecio ?? 0)}
            </span>
          </div>
        </div>

        <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary pt-1">
          <Link href="/admin/carta">
            <span>Ver carta actualizada</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  // Card para Ajuste Masivo de Precios
  if (toolName === 'ajustarPreciosMasivo' && result && typeof result === 'object') {
    const data = result as {
      exito?: boolean;
      porcentaje?: number;
      categoria?: string;
      totalProductosAjustados?: number;
      mensaje?: string;
      ejemplos?: Array<{ nombre: string; anterior: number; nuevo: number }>;
    };

    if (!data.exito) {
      return (
        <div className="my-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-900 dark:text-red-300">
          {data.mensaje}
        </div>
      );
    }

    const pct = data.porcentaje ?? 0;

    return (
      <div className="my-2 overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Percent className="size-4 text-primary" />
            <span>Ajuste Masivo de Precios</span>
          </div>
          <Badge variant="default" className="text-[10px]">
            {pct > 0 ? `+${pct}%` : `${pct}%`}
          </Badge>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground">{data.categoria}</p>
          <p className="text-[11px] text-muted-foreground">
            {data.totalProductosAjustados} productos modificados con éxito.
          </p>
        </div>

        {data.ejemplos && data.ejemplos.length > 0 && (
          <div className="space-y-1 bg-card/60 rounded-lg p-2 text-xs">
            {data.ejemplos.map((ej) => (
              <div key={ej.nombre} className="flex items-center justify-between text-[11px]">
                <span className="truncate max-w-[150px]">{ej.nombre}</span>
                <div className="flex items-center gap-1.5">
                  <span className="line-through text-muted-foreground">{formatPeso(ej.anterior)}</span>
                  <span className="font-semibold text-foreground">{formatPeso(ej.nuevo)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary pt-1">
          <Link href="/admin/carta">
            <span>Ver carta completa</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  // Card para Promociones Activas
  if (toolName === 'consultarPromocionesActivas' && result && typeof result === 'object') {
    const data = result as {
      totalPromociones?: number;
      promociones?: Array<{ id: string; nombre: string; tipo: string; valor: number; alcance: string }>;
    };

    const promos = data.promociones ?? [];

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-4 text-amber-500" />
            <span>Promociones Vigentes</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.totalPromociones ?? 0} activas
          </Badge>
        </div>

        {promos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No hay promociones activas actualmente.</p>
        ) : (
          <div className="space-y-1.5">
            {promos.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div>
                  <p className="font-semibold text-foreground">{p.nombre}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    Tipo: {p.tipo} · Alcance: {p.alcance}
                  </p>
                </div>
                {p.valor > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {p.tipo === 'porcentaje' ? `${p.valor}% OFF` : formatPeso(p.valor)}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary pt-1">
          <Link href="/admin/promociones">
            <span>Configurar promociones</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  // Card para Equipo y Personal (Staff)
  if (toolName === 'consultarEquipoStaff' && result && typeof result === 'object') {
    const data = result as {
      totalEmpleados?: number;
      activos?: number;
      inactivos?: number;
      distribucionPorRol?: Record<string, number>;
    };

    return (
      <div className="my-2 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Users className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Equipo y Personal (Staff)</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.activos ?? 0} activos / {data.totalEmpleados ?? 0} total
          </Badge>
        </div>

        {data.distribucionPorRol && Object.keys(data.distribucionPorRol).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(data.distribucionPorRol).map(([rol, cant]) => (
              <span
                key={rol}
                className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground capitalize"
              >
                {rol}: <strong className="font-semibold">{cant}</strong>
              </span>
            ))}
          </div>
        )}

        <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between text-xs font-medium text-primary pt-1">
          <Link href="/admin/staff">
            <span>Gestionar equipo y roles</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return null;
}
