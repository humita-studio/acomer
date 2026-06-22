import { create } from 'zustand';

/**
 * Estado de cliente de la comanda: sólo el callback de broadcast para avisar a
 * los otros dispositivos que el carrito cambió (lo registra RealtimeMesaSync).
 * El modelo del carrito (CartItem, getCartTotal) vive en `features/carta/cart`.
 */
type ComandaStore = {
  broadcastChange: (() => void) | null;
  setBroadcastChange: (fn: (() => void) | null) => void;
};

export const useComandaStore = create<ComandaStore>()((set) => ({
  broadcastChange: null,
  setBroadcastChange: (fn) => set({ broadcastChange: fn }),
}));
