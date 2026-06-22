'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { obtenerMenuVentaAction, obtenerMetodosVentaAction } from '../ventaMostradorActions';

/** Catálogo + métodos de pago para la venta de mostrador (server data → caché). */
export function useVentaMostradorData(tenantId: string) {
  const { data: menu } = useQuery({
    queryKey: queryKeys.menuVenta(tenantId),
    queryFn: () => obtenerMenuVentaAction(),
    staleTime: 60 * 1000,
  });
  const { data: metodos } = useQuery({
    queryKey: queryKeys.metodosVenta(tenantId),
    queryFn: () => obtenerMetodosVentaAction(),
    staleTime: 60 * 1000,
  });

  const mpDisponible = (metodos ?? []).some((m) => m.id === 'mercado_pago');

  return { menu, mpDisponible };
}
