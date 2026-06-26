'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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

/** Snapshot previo de la lista para poder revertir un update optimista. */
type CobrosSnapshot = { previous?: TransaccionCobro[] };

/**
 * Quita el cobro de la lista en caché al instante (update optimista) y devuelve
 * el estado previo. Cancela cualquier refetch en curso para que no pise el
 * cambio. Si el server action falla, `revertirCobros` restaura este snapshot.
 */
async function quitarCobroOptimista(
  queryClient: QueryClient,
  tenantId: string,
  id: string,
): Promise<CobrosSnapshot> {
  const key = queryKeys.cobros(tenantId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<TransaccionCobro[]>(key);
  queryClient.setQueryData<TransaccionCobro[]>(key, (old) =>
    (old ?? []).filter((tx) => tx.id !== id),
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
      aprobarPagoPresencialAction(id, tenantId, { montoRecibido }),
    // La tarjeta desaparece al instante; el server action corre en segundo plano.
    onMutate: ({ id }) => quitarCobroOptimista(queryClient, tenantId, id),
    onError: (_err, _vars, context) => {
      revertirCobros(queryClient, tenantId, context);
      toast.error('No se pudo aprobar el cobro. Volvé a intentarlo.');
    },
    onSuccess: (res, _vars, context) => {
      if (res.success) {
        toast.success(res.message ?? 'Cobro aprobado');
      } else {
        // Falló la validación del lado del servidor: devolvemos la tarjeta.
        revertirCobros(queryClient, tenantId, context);
        toast.error(res.message);
      }
    },
    // Reconcilia con el servidor una vez resuelto (éxito o error).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
    },
  });
}

export function useRechazarCobro(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rechazarPagoPresencialAction(id, tenantId),
    onMutate: (id) => quitarCobroOptimista(queryClient, tenantId, id),
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
