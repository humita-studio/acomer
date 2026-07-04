'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import { obtenerTicketMesaAction } from './ticket-mesa-actions';
import { agregarItemsStaffAction, type StaffItemInput } from './agregar-items-staff-action';
import type { TicketItem } from '@/features/pedidos/obtenerTicketMesa';

export type TicketData = { items: TicketItem[]; total: number };

/**
 * Ticket acumulado de una mesa (estado de servidor). `initial` siembra la caché
 * con lo que ya trajo el Server Component.
 */
export function useTicketMesa(sesionMesaId: string, initial: TicketData) {
  return useQuery({
    queryKey: queryKeys.ticketMesa(sesionMesaId),
    queryFn: () => obtenerTicketMesaAction(sesionMesaId),
    initialData: initial,
  });
}

export type AgregarItemsStaffVars = {
  items: StaffItemInput[];
  /** Items ya armados para el update optimista (con snapshot de nombre/precio). */
  optimisticItems: TicketItem[];
};

export function useAgregarItemsStaff(sesionMesaId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.ticketMesa(sesionMesaId);

  return useMutation({
    mutationFn: async (vars: AgregarItemsStaffVars) => {
      const res = await agregarItemsStaffAction(sesionMesaId, vars.items);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TicketData>(key) ?? { items: [], total: 0 };
      const items = [...previous.items, ...vars.optimisticItems];
      const total = items.reduce((acc, it) => acc + it.subtotal, 0);
      queryClient.setQueryData<TicketData>(key, { items, total });
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al agregar productos');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
