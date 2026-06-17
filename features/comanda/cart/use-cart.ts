'use client';

import type { CartItem } from '../store';
import {
  useBorrador,
  useAgregarItem,
  useEliminarItem,
  useActualizarCantidad,
  type AgregarItemVars,
} from '../use-borrador';

/**
 * Contrato común del carrito que consumen ProductModal/FloatingCart/MenuView.
 * Tiene dos drivers: `useServerCart` (borrador server-side, salón/externo con
 * sesión) y `useLocalCart` (localStorage, flujo externo "menú primero").
 */
export type CartApi = {
  items: CartItem[];
  agregar: (vars: AgregarItemVars) => Promise<void>;
  agregando: boolean;
  eliminar: (itemId: string) => void;
  actualizar: (itemId: string, nuevaCantidad: number) => void;
};

/** Driver server: el borrador compartido por sesión (TanStack Query). */
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
