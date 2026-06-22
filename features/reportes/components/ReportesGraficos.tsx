'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { Tag } from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/ui/card';
import type { ReporteData } from '@/features/reportes/types';

const MESES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const PROVEEDOR_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_fisica: 'Tarjeta',
  mercado_pago: 'Mercado Pago',
  mock: 'Prueba',
};

// Paleta del donut, ordenada por participación (terracota → ámbar → verde → arena).
const METODO_COLORES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-4)'];

/** "2026-06-01" → "1 jun" sin pasar por Date (evita corrimientos de zona). */
function etiquetaDia(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES_CORTO[m - 1]}`;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function GraficoVacio({ alto = 240, children }: { alto?: number; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height: alto }}
    >
      {children}
    </div>
  );
}

/**
 * Todos los gráficos de Reportes (recharts). Se carga con `next/dynamic` desde
 * ReportesManager para mantener recharts fuera del bundle inicial del panel.
 */
export function ReportesGraficos({
  ventasPorDia,
  ventasPorMetodo,
  topProductos,
  promociones,
  totalDescuentos,
  ocupacionPorHora,
}: {
  ventasPorDia: ReporteData['ventasPorDia'];
  ventasPorMetodo: ReporteData['ventasPorMetodo'];
  topProductos: ReporteData['topProductos'];
  promociones: ReporteData['promociones'];
  totalDescuentos: number;
  ocupacionPorHora: ReporteData['ocupacionPorHora'];
}) {
  // Ventas por día: etiqueta + variación contra el día anterior (para el tooltip).
  const dias = ventasPorDia.map((d, i, arr) => {
    const prev = i > 0 ? arr[i - 1].total : null;
    const delta = prev && prev > 0 ? ((d.total - prev) / prev) * 100 : null;
    return { ...d, label: etiquetaDia(d.fecha), delta };
  });

  // Ventas por método: ordenado por monto, con porcentaje y color asignados.
  const totalMetodos = ventasPorMetodo.reduce((acc, m) => acc + m.total, 0);
  const metodos = [...ventasPorMetodo]
    .sort((a, b) => b.total - a.total)
    .map((m, i) => ({
      label: PROVEEDOR_LABEL[m.proveedor] ?? capitalizar(m.proveedor),
      total: m.total,
      cantidad: m.cantidad,
      pct: totalMetodos > 0 ? Math.round((m.total / totalMetodos) * 100) : 0,
      color: METODO_COLORES[i % METODO_COLORES.length],
    }));

  // Top productos: barras de progreso normalizadas al más vendido.
  const top = topProductos.slice(0, 8);
  const maxCantidad = Math.max(1, ...top.map((p) => p.cantidad));

  // Ocupación por hora: barras con el pico resaltado.
  const horas = ocupacionPorHora.map((h) => ({ ...h, label: String(h.hora) }));
  const maxSesiones = Math.max(0, ...horas.map((h) => h.sesiones));
  const picoIdx =
    maxSesiones > 0 ? horas.reduce((mejor, h, i, arr) => (h.sesiones > arr[mejor].sesiones ? i : mejor), 0) : -1;

  return (
    <div className="space-y-6">
      {/* Fila 1: ventas por día + por método */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4">
            <div className="space-y-0.5">
              <h2 className="font-heading text-base font-medium">Ventas por día</h2>
              <p className="text-xs text-muted-foreground">Tendencia del período</p>
            </div>
            {dias.length === 0 ? (
              <GraficoVacio>Sin ventas en el período</GraficoVacio>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dias} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="ventasArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip cursor={{ stroke: 'var(--border-strong)' }} content={<DiaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#ventasArea)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-0.5">
              <h2 className="font-heading text-base font-medium">Ventas por método</h2>
              <p className="text-xs text-muted-foreground">Distribución por canal</p>
            </div>
            {metodos.length === 0 ? (
              <GraficoVacio>Sin ventas en el período</GraficoVacio>
            ) : (
              <div className="flex items-center gap-5">
                <div className="size-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metodos}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {metodos.map((m) => (
                          <Cell key={m.label} fill={m.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<MetodoTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex-1 space-y-3">
                  {metodos.map((m) => (
                    <li key={m.label} className="flex items-center gap-2.5 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: m.color }} />
                      <span className="flex-1 truncate text-foreground">{m.label}</span>
                      <span className="font-semibold tabular-nums">{m.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: top productos + ocupación por hora */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-heading text-base font-medium">Top productos</h2>
            {top.length === 0 ? (
              <GraficoVacio alto={200}>Sin productos vendidos</GraficoVacio>
            ) : (
              <div className="space-y-3.5">
                {top.map((p) => (
                  <div key={p.nombre} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate font-medium text-foreground" title={p.nombre}>
                      {p.nombre}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-chart-3"
                        style={{ width: `${(p.cantidad / maxCantidad) * 100}%` }}
                      />
                    </div>
                    <div className="w-24 shrink-0 text-right leading-tight">
                      <span className="font-semibold tabular-nums">{formatPeso(p.total)}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {p.cantidad} u.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-heading text-base font-medium">Ocupación por hora</h2>
            {maxSesiones === 0 ? (
              <GraficoVacio alto={220}>Sin sesiones en el período</GraficoVacio>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={horas} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} content={<HoraTooltip />} />
                  <Bar dataKey="sesiones" radius={[5, 5, 0, 0]} maxBarSize={28}>
                    {horas.map((_, i) => (
                      <Cell key={i} fill={i === picoIdx ? 'var(--chart-1)' : 'var(--chart-2)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila 3: promociones aplicadas */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="font-heading text-base font-medium">Promociones aplicadas</h2>
              <p className="text-xs text-muted-foreground">Descuentos otorgados en el período</p>
            </div>
            <div className="text-right leading-tight">
              <span className="font-display text-xl font-semibold tabular-nums text-success-foreground">
                −{formatPeso(totalDescuentos)}
              </span>
              <span className="block text-xs text-muted-foreground">total descontado</span>
            </div>
          </div>
          {promociones.length === 0 ? (
            <GraficoVacio alto={120}>Sin promociones aplicadas en el período</GraficoVacio>
          ) : (
            <ul className="divide-y divide-border/60">
              {promociones.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Tag className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium text-foreground" title={p.nombre}>
                      {p.nombre}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-4 tabular-nums">
                    <span className="text-muted-foreground">
                      {p.usos} {p.usos === 1 ? 'uso' : 'usos'}
                    </span>
                    <span className="w-24 text-right font-semibold text-success-foreground">
                      −{formatPeso(p.descuento)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
};

function DiaTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { label: string; total: number; delta: number | null };
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{d.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-popover-foreground">{formatPeso(d.total)}</p>
      {d.delta !== null && (
        <p className={cn('mt-0.5 tabular-nums', d.delta >= 0 ? 'text-success-foreground' : 'text-destructive')}>
          {d.delta >= 0 ? '+' : ''}
          {d.delta.toFixed(0)}% vs día previo
        </p>
      )}
    </div>
  );
}

function MetodoTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload as { label: string; total: number; cantidad: number; pct: number };
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{m.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-popover-foreground">{formatPeso(m.total)}</p>
      <p className="mt-0.5 text-muted-foreground tabular-nums">
        {m.pct}% · {m.cantidad} {m.cantidad === 1 ? 'cobro' : 'cobros'}
      </p>
    </div>
  );
}

function HoraTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const h = payload[0].payload as { hora: number; sesiones: number };
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{h.hora}:00 hs</p>
      <p className="mt-0.5 text-muted-foreground tabular-nums">
        {h.sesiones} {h.sesiones === 1 ? 'sesión' : 'sesiones'}
      </p>
    </div>
  );
}
