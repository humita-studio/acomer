'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import {
  getTransaccionesTableroAction,
  aprobarPagoPresencialAction,
  rechazarPagoPresencialAction,
} from '../cobrosActions';
import type { TransaccionCobro } from '../types';

/** Cobros del tablero (Pendiente + Aprobado + Rechazado). */
export function useCobrosTablero(tenantId: string, initial: TransaccionCobro[]) {
  return useQuery({
    queryKey: queryKeys.cobros(tenantId),
    queryFn: () => getTransaccionesTableroAction(),
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

/** Snapshot previo de la lista para poder revertir un update optimista. */
type CobrosSnapshot = { previous?: TransaccionCobro[] };

/**
 * Actualiza el estado del cobro optimistamente en la caché.
 * Para aprobaciones, mueve de Pendiente → Aprobado.
 * Para rechazos, mueve de Pendiente → Rechazado.
 */
async function moverCobroOptimista(
  queryClient: QueryClient,
  tenantId: string,
  id: string,
  nuevoEstado: 'Aprobado' | 'Rechazado',
): Promise<CobrosSnapshot> {
  const key = queryKeys.cobros(tenantId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<TransaccionCobro[]>(key);
  queryClient.setQueryData<TransaccionCobro[]>(key, (old) =>
    (old ?? []).map((tx) =>
      tx.id === id ? { ...tx, estado: nuevoEstado, resueltaAt: new Date() } : tx,
    ),
  );
  return { previous };
}

function revertirCobros(queryClient: QueryClient, tenantId: string, snapshot?: CobrosSnapshot) {
  if (snapshot?.previous) {
    queryClient.setQueryData(queryKeys.cobros(tenantId), snapshot.previous);
  }
}

export function useAprobarCobro(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, montoRecibido }: AprobarVars) =>
      aprobarPagoPresencialAction(id, { montoRecibido }),
    onMutate: ({ id }) => moverCobroOptimista(queryClient, tenantId, id, 'Aprobado'),
    onError: (_err, _vars, context) => {
      revertirCobros(queryClient, tenantId, context);
      toast.error('No se pudo aprobar el cobro. Volvé a intentarlo.');
    },
    onSuccess: (res, _vars, context) => {
      if (res.success) {
        toast.success(res.message ?? 'Cobro aprobado');
      } else {
        revertirCobros(queryClient, tenantId, context);
        toast.error(res.message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
      // El efectivo esperado de la caja cambia al aprobar un cobro.
      queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
    },
  });
}

export function useRechazarCobro(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rechazarPagoPresencialAction(id),
    onMutate: (id) => moverCobroOptimista(queryClient, tenantId, id, 'Rechazado'),
    onError: (_err, _vars, context) => {
      revertirCobros(queryClient, tenantId, context);
      toast.error('No se pudo rechazar el cobro. Volvé a intentarlo.');
    },
    onSuccess: (res, _vars, context) => {
      if (res.success) {
        toast.success(res.message ?? 'Cobro rechazado');
      } else {
        revertirCobros(queryClient, tenantId, context);
        toast.error(res.message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
    },
  });
}
