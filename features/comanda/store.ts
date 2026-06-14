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

type ComandaStore = {
  items: CartItem[];
  /** Replace the entire cart with items from the server */
  setItems: (items: CartItem[]) => void;
  /** Optimistically add an item (will be overridden by Realtime sync) */
  optimisticAdd: (item: CartItem) => void;
  /** Optimistically remove an item */
  optimisticRemove: (id: string) => void;
  /** Optimistically update quantity */
  optimisticUpdateQuantity: (id: string, newQuantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  /** Broadcast function set by RealtimeMesaSync — notifies other devices */
  _broadcastChange: (() => void) | null;
  _setBroadcastFn: (fn: (() => void) | null) => void;
};

export const useComandaStore = create<ComandaStore>()(
  (set, get) => ({
    items: [],
    _broadcastChange: null,

    _setBroadcastFn: (fn) => {
      set({ _broadcastChange: fn });
    },
    
    setItems: (items) => {
      set({ items });
    },

    optimisticAdd: (item) => {
      set((state) => ({ items: [...state.items, item] }));
    },

    optimisticRemove: (id) => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    },

    optimisticUpdateQuantity: (id, newQuantity) => {
      set((state) => ({
        items: state.items.map((item) => {
          if (item.id === id) {
            return { ...item, cantidad: newQuantity };
          }
          return item;
        }),
      }));
    },

    clearCart: () => {
      set({ items: [] });
    },

    getTotal: () => {
      const state = get();
      return state.items.reduce((total, item) => {
        const modsTotal = item.modificadores.reduce((sum, mod) => sum + mod.precioExtra, 0);
        return total + (item.precioUnitario + modsTotal) * item.cantidad;
      }, 0);
    },
  })
);
