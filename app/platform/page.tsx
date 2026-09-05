import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getPlatformStatsAction } from '@/features/platform/platformActions';
import { PLAN_LABEL, type PlatformAtencionMotivo, type PlatformStats } from '@/features/platform/types';
import { formatFecha, formatPeso } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

type Tile = { label: string; value: string; hint?: string; alerta?: boolean };

function Tiles({ titulo, tiles, cols }: { titulo: string; tiles: Tile[]; cols: string }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-semibold">{titulo}</h2>
      <div className={`grid gap-3 sm:grid-cols-2 ${cols}`}>
        {tiles.map((t) => (
          <Card key={t.label} size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`font-display text-3xl font-semibold tabular-nums ${t.alerta ? 'text-destructive' : ''}`}
              >
                {t.value}
              </div>
              {t.hint ? <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

const MOTIVO_LABEL: Record<PlatformAtencionMotivo, string> = {
  trial_por_vencer: 'Prueba por vencer',
  trial_vencido: 'Prueba vencida',
  periodo_por_vencer: 'Suscripción por vencer',
  vencido: 'Pago pendiente',
  sin_actividad: 'Sin actividad',
};

const ESTADO_PAGO_LABEL: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

function variacion(actual: number, anterior: number): string | undefined {
  if (anterior <= 0) return actual > 0 ? 'primer mes con cobros' : undefined;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs. mes anterior`;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function Resumen({ stats }: { stats: PlatformStats }) {
  const suscripciones: Tile[] = [
    {
      label: 'Cobrado este mes',
      value: formatPeso(stats.ingresos.mesActual),
      hint: stats.ingresos.pagosMesActual
        ? `${plural(stats.ingresos.pagosMesActual, 'pago', 'pagos')} · ${variacion(stats.ingresos.mesActual, stats.ingresos.mesAnterior) ?? ''}`
        : 'Todavía sin pagos este mes',
    },
    { label: 'Mes anterior', value: formatPeso(stats.ingresos.mesAnterior) },
    {
      label: 'Ingreso mensual recurrente',
      value: formatPeso(stats.mrr),
      hint: `${plural(stats.activosPago, 'local pagando', 'locales pagando')}`,
    },
    { label: 'Total histórico', value: formatPeso(stats.ingresos.total) },
  ];

  const locales: Tile[] = [
    {
      label: 'Locales',
      value: String(stats.total),
      hint: stats.nuevosMes ? `${plural(stats.nuevosMes, 'nuevo', 'nuevos')} este mes` : 'Sin altas este mes',
    },
    {
      label: 'En prueba',
      value: String(stats.trial),
      hint: stats.porVencer.trial7 ? `${stats.porVencer.trial7} vencen en 7 días` : undefined,
      alerta: stats.porVencer.trial7 > 0,
    },
    {
      label: 'Pagando',
      value: String(stats.activosPago),
      hint: stats.porVencer.periodo7 ? `${stats.porVencer.periodo7} vencen en 7 días` : undefined,
    },
    { label: 'Pago pendiente', value: String(stats.pastDue), alerta: stats.pastDue > 0 },
    { label: 'Exentos', value: String(stats.exempt), hint: 'demo y pilotos' },
    { label: 'Desactivados', value: String(stats.inactive) },
  ];

  const uso: Tile[] = [
    { label: 'Pedidos · 30 días', value: stats.uso.pedidos30d.toLocaleString('es-AR') },
    {
      label: 'Cobrado por los locales · 30 días',
      value: formatPeso(stats.uso.volumen30d),
      hint: 'ventas que pasaron por acomer',
    },
    { label: 'Pedidos hoy', value: stats.uso.pedidosHoy.toLocaleString('es-AR') },
    {
      label: 'Locales con actividad · 7 días',
      value: `${stats.uso.localesConActividad7d} / ${stats.activos}`,
    },
  ];

  return (
    <>
      <Tiles titulo="Suscripciones" tiles={suscripciones} cols="lg:grid-cols-4" />
      <Tiles titulo="Locales" tiles={locales} cols="lg:grid-cols-3" />
      <Tiles titulo="Uso del producto" tiles={uso} cols="lg:grid-cols-4" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning-foreground" aria-hidden />
              Requieren atención
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.atencion.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada pendiente. Todos los locales al día.</p>
            ) : (
              <ul className="divide-y">
                {stats.atencion.map((a) => (
                  <li key={`${a.id}-${a.motivo}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/platform/locales/${a.id}`} className="font-medium hover:underline">
                        {a.nombre}
                      </Link>
                      <p className="text-xs text-muted-foreground">{a.detalle}</p>
                    </div>
                    <Badge variant={a.motivo === 'sin_actividad' ? 'secondary' : 'destructive'}>
                      {MOTIVO_LABEL[a.motivo]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos pagos de suscripción</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pagosRecientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hubo pagos. Aparecen acá cuando un local paga su plan con Mercado Pago.
              </p>
            ) : (
              <ul className="divide-y">
                {stats.pagosRecientes.map((pg) => (
                  <li key={pg.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/platform/locales/${pg.localId}`} className="font-medium hover:underline">
                        {pg.localNombre}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatFecha(pg.fecha)} · {PLAN_LABEL[pg.plan]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium">{formatPeso(pg.monto)}</span>
                      <Badge variant={pg.estado === 'approved' ? 'secondary' : 'outline'}>
                        {ESTADO_PAGO_LABEL[pg.estado] ?? pg.estado}
                      </Badge>
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

export default async function PlatformHomePage() {
  const stats = await getPlatformStatsAction();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted-foreground">Cómo va acomer: suscripciones, locales y uso.</p>
        </div>
        <Button asChild>
          <Link href="/platform/locales">
            Ver locales
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>

      {stats ? (
        <Resumen stats={stats} />
      ) : (
        <p className="text-sm text-muted-foreground">No se pudieron cargar los datos. Probá recargar.</p>
      )}
    </div>
  );
}
