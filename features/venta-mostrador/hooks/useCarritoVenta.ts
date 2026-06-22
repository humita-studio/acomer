'use client';

import { useMemo, useState } from 'react';
import type { ProductoMenu } from '@/features/carta/types';
import type { StaffItemInput } from '@/features/pedidos/crearPedidoCore';
import type { CartLine } from '../types';

// Dos líneas se funden solo si son el mismo producto, la misma variante y los
// mismos adicionales.
const mergeKey = (productoId: string, varianteId: string | null, modIds: string[]) =>
  `${productoId}|${varianteId ?? ''}|${[...modIds].sort().join(',')}`;

/** Estado y operaciones del carrito local de la venta de mostrador. */
export function useCarritoVenta() {
  const [cart, setCart] = useState<CartLine[]>([]);

  const agregarProducto = (
    p: ProductoMenu,
    modIds: string[],
    cantidad: number,
    varianteId: string | null = null,
  ) => {
    const elegidos = p.modificadores.filter((m) => modIds.includes(m.id));
    const variante = varianteId ? p.variantes.find((v) => v.id === varianteId) ?? null : null;
    const precioBase = variante ? variante.precio : p.precio;
    const precioUnitario = precioBase + elegidos.reduce((s, m) => s + m.precioExtra, 0);
    const nombre = variante ? `${p.nombre} ${variante.nombre}` : p.nombre;
    const mk = mergeKey(p.id, varianteId, modIds);
    setCart((prev) => {
      const existente = prev.find(
        (l) => l.productoId && mergeKey(l.productoId, l.varianteId ?? null, l.modificadorIds) === mk,
      );
      if (existente) {
        return prev.map((l) =>
          l.key === existente.key ? { ...l, cantidad: l.cantidad + cantidad } : l,
        );
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          productoId: p.id,
          varianteId,
          nombre,
          precioUnitario,
          cantidad,
          modificadorIds: modIds,
          modificadoresNombres: elegidos.map((m) => m.nombre),
        },
      ];
    });
  };

  const agregarLibre = (nombre: string, precio: number, cantidad: number) => {
    setCart((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productoId: null,
        nombre,
        precioUnitario: precio,
        cantidad,
        modificadorIds: [],
        modificadoresNombres: [],
        nombreLibre: nombre,
        precioLibre: precio,
      },
    ]);
  };

  const cambiarCantidad = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );
  };

  const quitarLinea = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const limpiar = () => setCart([]);

  const total = useMemo(
    () => cart.reduce((acc, l) => acc + l.precioUnitario * l.cantidad, 0),
    [cart],
  );
  const cantidadItems = useMemo(
    () => cart.reduce((acc, l) => acc + l.cantidad, 0),
    [cart],
  );

  // Ítems en el formato que esperan las server actions. Memoizado para usarlo
  // como dependencia estable del preview de promos.
  const items = useMemo<StaffItemInput[]>(
    () =>
      cart.map((l) =>
        l.productoId
          ? {
              productoId: l.productoId,
              varianteId: l.varianteId,
              cantidad: l.cantidad,
              modificadorIds: l.modificadorIds,
            }
          : {
              productoId: null,
              cantidad: l.cantidad,
              nombreLibre: l.nombreLibre,
              precioLibre: l.precioLibre,
            },
      ),
    [cart],
  );

  return {
    cart,
    agregarProducto,
    agregarLibre,
    cambiarCantidad,
    quitarLinea,
    limpiar,
    total,
    cantidadItems,
    items,
  };
}
