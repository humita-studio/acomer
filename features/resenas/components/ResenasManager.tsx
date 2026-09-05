'use client';

import { ShieldCheck } from 'lucide-react';
import { ResenasMetrics } from './ResenasMetrics';
import { ResenasConfigCard } from './ResenasConfigCard';
import { ResenasFeed } from './ResenasFeed';
import type {
  ConfiguracionResenasDto,
  ResenaClienteDto,
  ResenasMetricsDto,
} from '../types';

export function ResenasManager({
  initialData,
}: {
  initialData: {
    resenas: ResenaClienteDto[];
    config: ConfiguracionResenasDto;
    metricas: ResenasMetricsDto;
  };
}) {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Reseñas
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-3" />
              Filtro activo
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Las opiniones buenas van a Google Maps; las quejas te llegan en privado para resolverlas antes.
          </p>
        </div>
      </div>

      {/* Métricas */}
      <ResenasMetrics metricas={initialData.metricas} />

      {/* Configuración de Google Maps */}
      <ResenasConfigCard initialConfig={initialData.config} />

      {/* Feed y resolución de feedback */}
      <ResenasFeed initialResenas={initialData.resenas} />
    </div>
  );
}
