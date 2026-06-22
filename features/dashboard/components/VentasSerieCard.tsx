'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { formatPeso } from '@/shared/lib/format';
import { Card, CardContent } from '@/shared/ui/card';
import type { DashboardMetrics } from '@/features/dashboard/types';

/**
 * Gráfico de serie de ventas (recharts). Se carga con `next/dynamic` desde
 * DashboardMetrics para mantener recharts fuera del bundle inicial del panel.
 */
export function VentasSerieCard({ serie }: { serie: DashboardMetrics['serie'] }) {
  const { modo, puntos } = serie;
  const max = Math.max(0, ...puntos.map((p) => p.total));
  const peakIdx = max > 0 ? puntos.reduce((b, p, i, arr) => (p.total > arr[b].total ? i : b), 0) : -1;
  const peak = peakIdx >= 0 ? puntos[peakIdx] : null;

  const titulo = modo === 'hora' ? 'Ventas por hora' : 'Ventas por día';
  const subtitulo = peak
    ? modo === 'hora'
      ? `Pico a las ${peak.label} h`
      : `Pico el ${peak.label}`
    : 'Sin ventas en el período';

  // Con muchas barras (mes), espaciamos las etiquetas del eje.
  const tickInterval = puntos.length > 16 ? Math.ceil(puntos.length / 12) : 0;

  return (
    <Card className="h-full">
      <CardContent className="space-y-4">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-medium">{titulo}</h2>
          <p className="text-xs text-muted-foreground">{subtitulo}</p>
        </div>

        {max === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Sin ventas registradas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={puntos} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              <Tooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltip modo={modo} />} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {puntos.map((p, i) => (
                  <Cell key={i} fill={i === peakIdx ? 'var(--chart-2)' : 'var(--chart-1)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  modo,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  modo: 'hora' | 'dia';
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">
        {modo === 'hora' ? `${label}:00 h` : label}
      </p>
      <p className="text-muted-foreground">{formatPeso(payload[0].value)}</p>
    </div>
  );
}
