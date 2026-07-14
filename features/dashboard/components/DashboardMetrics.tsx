'use client';

import { useState } from 'react';
import {
  Armchair,
  Bike,
  DollarSign,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { formatPeso, formatHora } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { useDashboardMetrics, useDashboardRealtime } from '@/features/dashboard/hooks/useDashboard';
import type {
  CanalPedido,
  DashboardMetrics,
  Periodo,
  PedidoReciente,
} from '@/features/dashboard/types';
import type { OnboardingStatus } from '@/features/dashboard/onboarding';
import { OnboardingChecklist } from '@/features/dashboard/components/OnboardingChecklist';
import { Card, CardContent } from '@/shared/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
];

const COMPARATIVA: Record<Periodo, string> = {
  hoy: 'vs ayer',
  semana: 'vs 7 días previos',
  mes: 'vs 30 días previos',
};

const SUFIJO_VENTAS: Record<Periodo, string> = {
  hoy: 'Ventas de hoy',
  semana: 'Ventas · 7 días',
  mes: 'Ventas · 30 días',
};

export function DashboardMetrics({
  initialData,
  tenantId,
  role,
  saludo,
  fecha,
  nombreRestaurante,
  onboarding = null,
  dominioPublico,
}: {
  initialData: DashboardMetrics;
  tenantId: string;
  role: RoleType;
  saludo: string;
  fecha: string;
  nombreRestaurante: string;
  onboarding?: OnboardingStatus | null;
  dominioPublico?: string;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(initialData.periodo);

  const { data: metrics = initialData } = useDashboardMetrics(tenantId, periodo, initialData);
  useDashboardRealtime(tenantId);

  const data = metrics ?? initialData;
  const puedeVerVentas = hasPermission(role, 'canViewReports');
  const { ocupacion, ventas, pedidos, salon, serie, pedidosRecientes } = data;
  const comparativa = COMPARATIVA[periodo];
  const setupIncompleto = onboarding && !onboarding.listo;

  return (
    <div className="space-y-6">
      {/* Encabezado: saludo + selector de período */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{saludo}</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {fecha} ·{' '}
            {setupIncompleto
              ? `configuremos ${nombreRestaurante} para el primer servicio`
              : `esto es lo que está pasando en ${nombreRestaurante}`}
          </p>
        </div>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList>
            {PERIODOS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Checklist de primer día (owner/admin, mientras falte setup) */}
      {onboarding ? (
        <OnboardingChecklist
          status={onboarding}
          tenantId={tenantId}
          nombreRestaurante={nombreRestaurante}
          dominioPublico={dominioPublico}
        />
      ) : null}

      {/* Métricas principales */}
      <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', puedeVerVentas && 'lg:grid-cols-4')}>
        {puedeVerVentas && (
          <MetricCard
            label={SUFIJO_VENTAS[periodo]}
            value={formatPeso(ventas.total)}
            icon={DollarSign}
            footer={<Trend pct={ventas.deltaTotalPct} comparativa={comparativa} />}
          />
        )}
        <MetricCard
          label="Pedidos"
          value={pedidos.total.toLocaleString('es-AR')}
          icon={ShoppingBag}
          footer={<Trend pct={pedidos.deltaPct} comparativa={comparativa} />}
        />
        {puedeVerVentas && (
          <MetricCard
            label="Ticket promedio"
            value={formatPeso(ventas.ticketPromedio)}
            icon={Receipt}
            footer={<Trend pct={ventas.deltaTicketPct} comparativa={comparativa} />}
          />
        )}
        <MetricCard
          label="Mesas activas"
          value={`${ocupacion.mesasOcupadas} / ${ocupacion.totalMesas}`}
          icon={Armchair}
          footer={<span className="text-xs text-muted-foreground">ahora</span>}
        />
      </div>

      {/* Gráfico + estado del salón */}
      <div className={cn('grid grid-cols-1 gap-4', puedeVerVentas && 'lg:grid-cols-3')}>
        {puedeVerVentas && (
          <div className="lg:col-span-2">
            <VentasSerieCard serie={serie} />
          </div>
        )}
        <EstadoSalonCard salon={salon} />
      </div>

      {/* Pedidos recientes */}
      <PedidosRecientesCard pedidos={pedidosRecientes} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon: Icon,
  footer,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  footer: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
        </div>
        <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        {footer}
      </CardContent>
    </Card>
  );
}

function Trend({ pct, comparativa }: { pct: number | null; comparativa: string }) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">sin datos previos</span>;
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const texto = `${up ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-medium',
          up ? 'text-success-foreground' : 'text-destructive'
        )}
      >
        <Icon className="size-3.5" />
        {texto}
      </span>
      <span className="text-muted-foreground">{comparativa}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Serie de ventas: recharts se carga aparte (next/dynamic) para no incluirlo
// en el bundle inicial del panel. Skeleton mientras llega el chunk.
// ---------------------------------------------------------------------------

const VentasSerieCard = dynamic(
  () => import('./VentasSerieCard').then((m) => m.VentasSerieCard),
  {
    ssr: false,
    loading: () => (
      <Card className="h-full">
        <CardContent className="space-y-4">
          <div className="space-y-0.5">
            <h2 className="font-heading text-base font-medium">Ventas</h2>
            <p className="text-xs text-muted-foreground">Cargando gráfico…</p>
          </div>
          <div className="h-[220px] animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    ),
  },
);

// ---------------------------------------------------------------------------
// Estado del salón
// ---------------------------------------------------------------------------

function EstadoSalonCard({ salon }: { salon: DashboardMetrics['salon'] }) {
  const total = salon.total > 0 ? salon.total : 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const ancho = (n: number) => `${(n / total) * 100}%`;

  return (
    <Card className="h-full">
      <CardContent className="space-y-5">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-medium">Estado del salón</h2>
          <p className="text-xs text-muted-foreground">{salon.total} mesas en total</p>
        </div>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="bg-chart-1" style={{ width: ancho(salon.ocupadas) }} />
          <div className="bg-chart-2" style={{ width: ancho(salon.reservadas) }} />
          <div className="bg-border-strong" style={{ width: ancho(salon.libres) }} />
        </div>

        <div className="space-y-3">
          <SalonLegend color="bg-chart-1" label="Ocupadas" value={salon.ocupadas} pct={pct(salon.ocupadas)} />
          <SalonLegend color="bg-chart-2" label="Reservadas" value={salon.reservadas} pct={pct(salon.reservadas)} />
          <SalonLegend color="bg-border-strong" label="Libres" value={salon.libres} pct={pct(salon.libres)} />
        </div>
      </CardContent>
    </Card>
  );
}

function SalonLegend({
  color,
  label,
  value,
  pct,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn('size-2.5 shrink-0 rounded-full', color)} />
      <span className="text-foreground">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pedidos recientes
// ---------------------------------------------------------------------------

const CANAL_ICON: Record<CanalPedido, LucideIcon> = {
  salon: Armchair,
  takeaway: ShoppingBag,
  delivery: Bike,
  mostrador: ShoppingCart,
  otro: ShoppingBag,
};

function PedidosRecientesCard({ pedidos }: { pedidos: PedidoReciente[] }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-medium">Pedidos recientes</h2>
          <p className="text-xs text-muted-foreground">Últimas comandas de todos los canales</p>
        </div>

        {pedidos.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Todavía no hay pedidos hoy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Pedido</th>
                  <th className="pb-2 pr-3 font-medium">Canal</th>
                  <th className="pb-2 pr-3 text-right font-medium">Ítems</th>
                  <th className="pb-2 pr-3 text-right font-medium">Total</th>
                  <th className="pb-2 pr-3 font-medium">Estado</th>
                  <th className="pb-2 text-right font-medium">Hora</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const Icon = CANAL_ICON[p.canal];
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium tabular-nums">{p.ref}</td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          {p.canalLabel}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">
                        {p.items} {p.items === 1 ? 'ítem' : 'ítems'}
                      </td>
                      <td className="py-3 pr-3 text-right font-medium tabular-nums">
                        {formatPeso(p.total)}
                      </td>
                      <td className="py-3 pr-3">
                        <EstadoBadge estado={p.estado} />
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {formatHora(p.hora)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ESTADO_TONO: Record<string, { label: string; className: string }> = {
  Pendiente: { label: 'Pendiente', className: 'bg-warning-subtle text-warning-foreground' },
  'En Preparación': { label: 'En cocina', className: 'bg-warning-subtle text-warning-foreground' },
  Listo: { label: 'Listo', className: 'bg-success-subtle text-success-foreground' },
  Servido: { label: 'Servido', className: 'bg-success-subtle text-success-foreground' },
  Entregado: { label: 'Entregado', className: 'bg-success-subtle text-success-foreground' },
  Pagado: { label: 'Cobrado', className: 'bg-success-subtle text-success-foreground' },
  Cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive' },
};

function EstadoBadge({ estado }: { estado: string }) {
  const tono = ESTADO_TONO[estado] ?? { label: estado, className: 'bg-muted text-muted-foreground' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        tono.className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {tono.label}
    </span>
  );
}
