'use client';

import Link from 'next/link';
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
import { formatPeso } from '@/shared/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { PlatformStats } from '../types';

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-09" → "sep 26"; "2026-09-05" → "5 sep". Sin Date, para no correr la zona. */
function etiquetaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES_CORTO[m - 1]} ${String(y).slice(2)}`;
}
function etiquetaDia(dia: string): string {
  const [, m, d] = dia.split('-').map(Number);
  return `${d} ${MESES_CORTO[m - 1]}`;
}
function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function Vacio({ alto = 220, children }: { alto?: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: alto }}>
      {children}
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
};

function CajaTooltip({ titulo, lineas }: { titulo: string; lineas: string[] }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{titulo}</p>
      {lineas.map((l) => (
        <p key={l} className="text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

function IngresoTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { mes: string; monto: number; pagos: number };
  return (
    <CajaTooltip
      titulo={etiquetaMes(p.mes)}
      lineas={[formatPeso(p.monto), plural(p.pagos, 'pago', 'pagos')]}
    />
  );
}

function PedidosTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { dia: string; pedidos: number; volumen: number };
  return (
    <CajaTooltip
      titulo={etiquetaDia(p.dia)}
      lineas={[plural(p.pedidos, 'pedido', 'pedidos'), `${formatPeso(p.volumen)} cobrados`]}
    />
  );
}

function AltasTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { mes: string; altas: number };
  return <CajaTooltip titulo={etiquetaMes(p.mes)} lineas={[plural(p.altas, 'local nuevo', 'locales nuevos')]} />;
}

function EstadoTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { label: string; value: number };
  return <CajaTooltip titulo={p.label} lineas={[plural(p.value, 'local', 'locales')]} />;
}

const ESTADO_COLORES = ['var(--chart-2)', 'var(--chart-3)', 'var(--destructive)', 'var(--chart-5)', 'var(--chart-4)'];

export function PlatformGraficos({ stats }: { stats: PlatformStats }) {
  const { series } = stats;
  const mesActual = series.ingresosPorMes.at(-1)?.mes;
  const hayIngresos = series.ingresosPorMes.some((m) => m.monto > 0);
  const hayPedidos = series.pedidosPorDia.some((d) => d.pedidos > 0);
  const hayAltas = series.altasPorMes.some((m) => m.altas > 0);

  const estados = [
    { label: 'En prueba', value: stats.trial },
    { label: 'Pagando', value: stats.activosPago },
    { label: 'Pago pendiente', value: stats.pastDue },
    { label: 'Exentos', value: stats.exempt },
    { label: 'Desactivados', value: stats.inactive },
  ]
    .map((e, i) => ({ ...e, color: ESTADO_COLORES[i] }))
    .filter((e) => e.value > 0);

  const maxVolumen = Math.max(1, ...series.topLocales.map((l) => l.volumen30d));

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ingresos por suscripción</CardTitle>
            <p className="text-xs text-muted-foreground">Cobrado por mes, últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            {hayIngresos ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series.ingresosPorMes} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="mes"
                    tickFormatter={etiquetaMes}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} content={<IngresoTooltip />} />
                  <Bar dataKey="monto" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {series.ingresosPorMes.map((m) => (
                      <Cell key={m.mes} fill={m.mes === mesActual ? 'var(--chart-1)' : 'var(--chart-2)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Vacio>Todavía no hubo cobros de suscripción.</Vacio>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado de la cartera</CardTitle>
            <p className="text-xs text-muted-foreground">{plural(stats.total, 'local', 'locales')}</p>
          </CardHeader>
          <CardContent>
            {estados.length === 0 ? (
              <Vacio alto={200}>Sin locales todavía.</Vacio>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-[160px] w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={estados}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="var(--card)"
                      >
                        {estados.map((e) => (
                          <Cell key={e.label} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<EstadoTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                  {estados.map((e) => (
                    <li key={e.label} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden />
                        <span className="truncate">{e.label}</span>
                      </span>
                      <span className="tabular-nums font-medium">{e.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pedidos por día</CardTitle>
          <p className="text-xs text-muted-foreground">Todos los locales, últimos 30 días</p>
        </CardHeader>
        <CardContent>
          {hayPedidos ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series.pedidosPorDia} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="plataformaPedidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dia"
                  tickFormatter={etiquetaDia}
                  interval={6}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <Tooltip cursor={{ stroke: 'var(--border-strong)' }} content={<PedidosTooltip />} />
                <Area
                  type="monotone"
                  dataKey="pedidos"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#plataformaPedidos)"
                  activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Vacio>Sin pedidos en los últimos 30 días.</Vacio>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Locales nuevos</CardTitle>
            <p className="text-xs text-muted-foreground">Altas por mes, últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            {hayAltas ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={series.altasPorMes} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="mes"
                    tickFormatter={etiquetaMes}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} content={<AltasTooltip />} />
                  <Bar dataKey="altas" radius={[6, 6, 0, 0]} maxBarSize={48} fill="var(--chart-3)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Vacio alto={200}>Sin altas en los últimos 6 meses.</Vacio>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Locales que más mueven</CardTitle>
            <p className="text-xs text-muted-foreground">Cobrado a sus clientes, últimos 30 días</p>
          </CardHeader>
          <CardContent>
            {series.topLocales.length === 0 ? (
              <Vacio alto={200}>Ningún local cobró en los últimos 30 días.</Vacio>
            ) : (
              <ul className="space-y-3">
                {series.topLocales.map((l) => (
                  <li key={l.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/platform/locales/${l.id}`} className="min-w-0 truncate font-medium hover:underline">
                        {l.nombre}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {plural(l.pedidos30d, 'pedido', 'pedidos')} ·{' '}
                        <span className="font-medium text-foreground tabular-nums">{formatPeso(l.volumen30d)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--chart-1)]"
                        style={{ width: `${Math.max(4, Math.round((l.volumen30d / maxVolumen) * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
