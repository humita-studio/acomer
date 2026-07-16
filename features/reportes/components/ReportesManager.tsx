'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Download } from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
import { useReporte } from '@/features/reportes/hooks/useReporte';
import {
  PRESETS,
  type Preset,
  detectarPreset,
  rangoPreset,
  rangoTexto,
} from '@/features/reportes/dateRange';
import { DateRangePicker } from '@/features/reportes/components/DateRangePicker';
import { reporteToCsv } from '@/features/reportes/exportCsv';
import type { ReporteData } from '@/features/reportes/types';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

// recharts se carga aparte (next/dynamic) para no incluirlo en el bundle
// inicial del panel. Skeleton mientras llega el chunk.
const ReportesGraficos = dynamic(
  () => import('./ReportesGraficos').then((m) => m.ReportesGraficos),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-[320px] animate-pulse rounded-xl border bg-card lg:col-span-2" />
          <div className="h-[320px] animate-pulse rounded-xl border bg-card" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-[300px] animate-pulse rounded-xl border bg-card" />
          <div className="h-[300px] animate-pulse rounded-xl border bg-card" />
        </div>
      </div>
    ),
  },
);

export function ReportesManager({
  initialData,
  tenantId,
  hoy,
  desdeInicial,
  hastaInicial,
}: {
  initialData: ReporteData;
  tenantId: string;
  hoy: string;
  desdeInicial: string;
  hastaInicial: string;
}) {
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [preset, setPreset] = useState<Preset | ''>(() =>
    detectarPreset(desdeInicial, hastaInicial, hoy),
  );

  const { data: reporte = initialData, isFetching } = useReporte(tenantId, desde, hasta, {
    data: initialData,
    desde: desdeInicial,
    hasta: hastaInicial,
  });

  const { resumen, ventasPorDia, ventasPorMetodo, topProductos, promociones, ocupacionPorHora } =
    reporte;

  function aplicarPreset(p: Preset) {
    const r = rangoPreset(p, hoy);
    setDesde(r.desde);
    setHasta(r.hasta);
    setPreset(p);
  }

  function aplicarRango(d: string, h: string) {
    setDesde(d);
    setHasta(h);
    setPreset(detectarPreset(d, h, hoy));
  }

  function descargarCsv() {
    const csv = reporteToCsv(reporte, desde, hasta);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Encabezado: título + rango de fechas */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            {rangoTexto(desde, hasta)}
            {isFetching && <span className="ml-2 text-xs text-muted-foreground/70">· actualizando…</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={descargarCsv}>
            <Download className="size-4" aria-hidden />
            Exportar CSV
          </Button>
          <DateRangePicker desde={desde} hasta={hasta} hoy={hoy} onApply={aplicarRango} />
        </div>
      </div>

      {/* Presets de rango */}
      <Tabs value={preset} onValueChange={(v) => aplicarPreset(v as Preset)}>
        <TabsList>
          {PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <TarjetaResumen titulo="Ventas totales" valor={formatPeso(resumen.totalVentas)} />
        <TarjetaResumen titulo="Cobros" valor={resumen.cantidadCobros.toLocaleString('es-AR')} />
        <TarjetaResumen titulo="Ticket promedio" valor={formatPeso(resumen.ticketPromedio)} />
        <TarjetaResumen titulo="Mesas atendidas" valor={resumen.mesasAtendidas.toLocaleString('es-AR')} />
        <TarjetaResumen
          titulo="Ocupación promedio"
          valor={`${resumen.tiempoPromedioOcupacionMin} min`}
          sub="por mesa cerrada"
        />
      </div>

      <ReportesGraficos
        ventasPorDia={ventasPorDia}
        ventasPorMetodo={ventasPorMetodo}
        topProductos={topProductos}
        promociones={promociones}
        totalDescuentos={resumen.totalDescuentos}
        ocupacionPorHora={ocupacionPorHora}
      />
    </div>
  );
}

function TarjetaResumen({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
        <p className="font-display text-2xl font-semibold tracking-tight tabular-nums">{valor}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
