'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { StaffItemInput } from '@/features/pedidos/crearPedidoCore';
import {
  previsualizarVentaMostradorAction,
  type PreviewVentaMostrador,
} from '../ventaMostradorActions';
import type { Metodo } from '../types';

/**
 * Preview del cobro (subtotal/descuento/total + promos) recalculado en server
 * cada vez que cambia el método o se quita una promo. Mientras carga, o si falla,
 * el caller cae al total local sin descuento.
 */
export function useVentaPreview({
  items,
  metodo,
  omitirIds,
  enabled,
}: {
  items: StaffItemInput[];
  metodo: Metodo;
  omitirIds: string[];
  enabled: boolean;
}) {
  const query = useQuery<PreviewVentaMostrador | null>({
    queryKey: queryKeys.ventaPreview(metodo, omitirIds, items),
    queryFn: async () => {
      const res = await previsualizarVentaMostradorAction(items, { metodo, omitirIds });
      return res.success && res.preview ? res.preview : null;
    },
    enabled: enabled && items.length > 0,
    staleTime: 30_000,
  });

  return { preview: query.data ?? null, cargando: query.isFetching };
}
