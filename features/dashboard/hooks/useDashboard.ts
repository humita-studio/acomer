'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
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
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);

    const invalidar = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(tenantId) });

    channel
      .on('broadcast', { event: 'ocupacion_cambiada' }, invalidar)
      .on('broadcast', { event: 'cuenta_solicitada' }, invalidar)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}
