'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { getReporteAction } from '../reportesActions';
import type { ReporteData } from '../types';

/**
 * Reporte agregado para un rango de fechas. `initial` siembra la caché con lo
 * que ya trajo el Server Component, pero solo mientras el rango no cambió;
 * `keepPreviousData` evita parpadeos al mover las fechas.
 */
export function useReporte(
  tenantId: string,
  desde: string,
  hasta: string,
  initial: { data: ReporteData; desde: string; hasta: string }
) {
  return useQuery({
    queryKey: queryKeys.reportes(tenantId, desde, hasta),
    queryFn: () => getReporteAction(tenantId, desde, hasta),
    initialData: desde === initial.desde && hasta === initial.hasta ? initial.data : undefined,
    placeholderData: keepPreviousData,
  });
}
