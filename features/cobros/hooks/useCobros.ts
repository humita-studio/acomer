'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import {
  getTransaccionesPendientesAction,
  aprobarPagoPresencialAction,
  rechazarPagoPresencialAction,
} from '../cobrosActions';
import type { TransaccionCobro } from '../types';

/** Cobros presenciales pendientes de aprobación. Siembra la caché con el fetch del Server Component. */
export function useCobrosPendientes(tenantId: string, initial: TransaccionCobro[]) {
  return useQuery({
    queryKey: queryKeys.cobros(tenantId),
    queryFn: () => getTransaccionesPendientesAction(tenantId),
    initialData: initial,
  });
}

/** Invalida la lista cuando una mesa solicita la cuenta. */
export function useCobrosRealtime(tenantId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);
    channel
      .on('broadcast', { event: 'cuenta_solicitada' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}

type AprobarVars = { id: string; montoRecibido?: number };

export function useAprobarCobro(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, montoRecibido }: AprobarVars) =>
      aprobarPagoPresencialAction(id, tenantId, { montoRecibido }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message ?? 'Cobro aprobado');
        queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
      } else {
        toast.error(res.message);
      }
    },
  });
}

export function useRechazarCobro(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rechazarPagoPresencialAction(id, tenantId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message ?? 'Cobro rechazado');
        queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
      } else {
        toast.error(res.message);
      }
    },
  });
}
