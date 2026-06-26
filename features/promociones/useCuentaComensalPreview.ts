'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { PromoMetodoPago } from './promociones';
import {
  previsualizarCuentaComensalAction,
  type PreviewPromosCarrito,
} from './promosPublicasActions';

/**
 * Opciones de la query del preview, compartidas por el hook y el prefetch del
 * modal (que precalienta el cache de todos los métodos al abrir, así el primer tap
 * ya cae al cache y no se ve "Calculando…").
 */
export function cuentaPreviewQueryOptions(
  sesionMesaId: string,
  tenantId: string,
  metodoPago: PromoMetodoPago | null,
) {
  return {
    queryKey: queryKeys.cuentaPreview(sesionMesaId, metodoPago ?? 'sin-metodo'),
    queryFn: async (): Promise<PreviewPromosCarrito | null> => {
      const res = await previsualizarCuentaComensalAction(sesionMesaId, tenantId, { metodoPago });
      return res.success && res.preview ? res.preview : null;
    },
    staleTime: 60_000,
  };
}

/**
 * Descuento method-aware sobre una cuenta YA persistida (modal de pago del
 * comensal). Cacheado por método con TanStack Query: cambiar entre métodos no
 * recarga lo ya consultado (cae al cache) y volver a uno previo es instantáneo.
 * Espejo de `useVentaPreview` del mostrador.
 */
export function useCuentaComensalPreview({
  sesionMesaId,
  tenantId,
  metodoPago,
}: {
  sesionMesaId: string;
  tenantId: string;
  metodoPago: PromoMetodoPago | null;
}): { preview: PreviewPromosCarrito | null; cargando: boolean } {
  const query = useQuery<PreviewPromosCarrito | null>({
    ...cuentaPreviewQueryOptions(sesionMesaId, tenantId, metodoPago),
    enabled: !!sesionMesaId && !!tenantId && !!metodoPago,
  });

  return { preview: query.data ?? null, cargando: query.isFetching };
}
