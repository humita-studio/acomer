'use client';

import { useBroadcast } from '@/shared/supabase/realtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { getDashboardMetricsAction } from '../dashboardActions';
import type { DashboardMetrics, Periodo } from '../types';

/** Métricas del dashboard para un período. Se refrescan cada 30s además del realtime. */
export function useDashboardMetrics(tenantId: string, periodo: Periodo, initial: DashboardMetrics) {
  return useQuery({
    queryKey: [...queryKeys.dashboard(tenantId), periodo],
    queryFn: () => getDashboardMetricsAction(periodo),
    initialData: periodo === initial.periodo ? initial : undefined,
    placeholderData: (prev) => prev,
    refetchInterval: 30 * 1000,
  });
}

/** Invalida las métricas cuando cambia la ocupación o se solicita una cuenta. */
export function useDashboardRealtime(tenantId: string) {
  const queryClient = useQueryClient();
  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(tenantId) });
  useBroadcast(`admin_restaurant_${tenantId}`, {
    ocupacion_cambiada: invalidar,
    cuenta_solicitada: invalidar,
    cobro_actualizado: invalidar,
    mesa_pagada: invalidar,
  });
}
