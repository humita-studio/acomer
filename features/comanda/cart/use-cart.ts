'use client';

import type { CartItem, CartApi } from '@/features/carta/cart';
import {
  useBorrador,
  useAgregarItem,
  useEliminarItem,
  useActualizarCantidad,
} from '../use-borrador';

/**
 * Driver server del carrito: el borrador compartido por sesión (TanStack Query).
 * Implementa el `CartApi` de carta para el flujo de salón / externo con sesión.
 */
export function useServerCart(
  tenantId: string,
  sesionMesaId: string,
  initialItems?: CartItem[],
): CartApi {
  const { data: items = [] } = useBorrador(sesionMesaId, initialItems);
  const agregarM = useAgregarItem(tenantId, sesionMesaId);
  const eliminarM = useEliminarItem(tenantId, sesionMesaId);
  const actualizarM = useActualizarCantidad(tenantId, sesionMesaId);

  return {
    items,
    agregar: async (vars) => {
      await agregarM.mutateAsync(vars);
    },
    agregando: agregarM.isPending,
    eliminar: (itemId) => eliminarM.mutate(itemId),
    actualizar: (itemId, nuevaCantidad) => actualizarM.mutate({ itemId, nuevaCantidad }),
  };
}
