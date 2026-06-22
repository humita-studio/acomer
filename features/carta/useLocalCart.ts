'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Modificador, AgregarItemVars, CartApi } from './cart';

/** Mismo producto con el mismo set de modificadores (comparando por id). */
function sameMods(a: Modificador[], b: Modificador[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].map((m) => m.id).sort();
  const bs = [...b].map((m) => m.id).sort();
  return as.every((id, i) => id === bs[i]);
}

type LocalCartState = {
  tenantId: string | null;
  items: CartItem[];
  setTenant: (t: string) => void;
  agregar: (vars: AgregarItemVars) => void;
  eliminar: (itemId: string) => void;
  actualizar: (itemId: string, nuevaCantidad: number) => void;
  limpiar: () => void;
};

/**
 * Carrito local (sin DB) para el flujo "menú primero": el cliente navega la
 * carta y arma el pedido sin identificarse; recién en el checkout se crea todo.
 * Persiste en localStorage para sobrevivir un refresh.
 */
export const useLocalCartStore = create<LocalCartState>()(
  persist(
    (set) => ({
      tenantId: null,
      items: [],
      setTenant: (t) =>
        set((s) => (s.tenantId === t ? {} : { tenantId: t, items: [] })),
      agregar: (vars) =>
        set((s) => {
          const same = s.items.find(
            (e) =>
              e.productoId === vars.productoId &&
              (e.varianteId ?? null) === (vars.varianteId ?? null) &&
              sameMods(e.modificadores, vars.modificadores),
          );
          if (same) {
            return {
              items: s.items.map((e) =>
                e.id === same.id ? { ...e, cantidad: e.cantidad + vars.cantidad } : e,
              ),
            };
          }
          return {
            items: [
              ...s.items,
              {
                id: crypto.randomUUID(),
                productoId: vars.productoId,
                varianteId: vars.varianteId ?? null,
                nombre: vars.nombreProducto,
                precioUnitario: vars.precioUnitario,
                cantidad: vars.cantidad,
                modificadores: vars.modificadores,
              },
            ],
          };
        }),
      eliminar: (itemId) => set((s) => ({ items: s.items.filter((e) => e.id !== itemId) })),
      actualizar: (itemId, nuevaCantidad) =>
        set((s) => ({
          items: s.items.map((e) =>
            e.id === itemId ? { ...e, cantidad: Math.max(1, nuevaCantidad) } : e,
          ),
        })),
      limpiar: () => set({ items: [] }),
    }),
    { name: 'acomer-cart-externo' },
  ),
);

/** Driver local: expone el store como CartApi. Evita mismatch de hidratación. */
export function useLocalCart(tenantId: string): CartApi {
  const items = useLocalCartStore((s) => s.items);
  const setTenant = useLocalCartStore((s) => s.setTenant);
  const agregar = useLocalCartStore((s) => s.agregar);
  const eliminar = useLocalCartStore((s) => s.eliminar);
  const actualizar = useLocalCartStore((s) => s.actualizar);

  // `false` en SSR y primer render, `true` tras hidratar: evita el mismatch con
  // el carrito persistido en localStorage sin usar setState dentro de un effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useEffect(() => {
    setTenant(tenantId);
  }, [tenantId, setTenant]);

  return {
    items: mounted ? items : [],
    agregar: async (vars) => agregar(vars),
    agregando: false,
    eliminar,
    actualizar,
  };
}
