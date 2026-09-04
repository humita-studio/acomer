'use client';

import { Star, ShieldAlert, ArrowUpRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { ResenasMetricsDto } from '../types';

export function ResenasMetrics({ metricas }: { metricas: ResenasMetricsDto }) {
  const pctGoogle =
    metricas.total > 0
      ? Math.round((metricas.derivadasGoogle / metricas.total) * 100)
      : 0;
  const pctPrivadas =
    metricas.total > 0
      ? Math.round((metricas.privadasNegativas / metricas.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* 4 Cards principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Promedio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Promedio interno
            </CardTitle>
            <Star className="size-4 fill-amber-400 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">
                {metricas.promedio > 0 ? metricas.promedio.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-muted-foreground">de 5 estrellas</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {metricas.total} opiniones registradas
            </p>
          </CardContent>
        </Card>

        {/* Derivadas a Google */}
        <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Derivadas a Google
            </CardTitle>
            <ArrowUpRight className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {metricas.derivadasGoogle}
              </span>
              <span className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/80">
                ({pctGoogle}%)
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Clientes con 4 o 5 estrellas guiados a Google Maps
            </p>
          </CardContent>
        </Card>

        {/* Retenidas en Privado */}
        <Card className="border-amber-500/20 bg-amber-500/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Filtro de quejas
            </CardTitle>
            <ShieldAlert className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
                {metricas.privadasNegativas}
              </span>
              <span className="text-xs font-semibold text-amber-700/80 dark:text-amber-300/80">
                ({pctPrivadas}%)
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Quejas contenidas sin llegar a Google Maps
            </p>
          </CardContent>
        </Card>

        {/* Distribución */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Distribución
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1 pt-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = metricas.distribucionEstrellas[stars] || 0;
              const pct = metricas.total > 0 ? (count / metricas.total) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-5 font-mono">{stars}★</span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top motivos de queja si hay datos */}
      {metricas.topAspectos.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">
                Motivos más recurrentes en feedback negativo
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {metricas.topAspectos.map((item) => (
                <div
                  key={item.aspecto}
                  className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-bold text-destructive">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
