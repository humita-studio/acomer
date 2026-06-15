import { create } from 'zustand';

export type Modificador = {
  id: string;
  nombre: string;
  precioExtra: number;
};

export type CartItem = {
  id: string; // ID from the database (items_borrador_mesa.id)
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  modificadores: Modificador[];
};

/** Total del carrito: (precio base + adicionales) * cantidad, por item. */
export function getCartTotal(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const modsTotal = item.modificadores.reduce((sum, mod) => sum + mod.precioExtra, 0);
    return total + (item.precioUnitario + modsTotal) * item.cantidad;
  }, 0);
}

/**
 * Estado de cliente de la comanda. El carrito (estado de servidor) vive en
 * TanStack Query; acá solo queda la función para avisar por broadcast a los
 * otros dispositivos que el carrito cambió (la registra RealtimeMesaSync).
 */
type ComandaStore = {
  broadcastChange: (() => void) | null;
  setBroadcastChange: (fn: (() => void) | null) => void;
};

export const useComandaStore = create<ComandaStore>()((set) => ({
  broadcastChange: null,
  setBroadcastChange: (fn) => set({ broadcastChange: fn }),
}));
