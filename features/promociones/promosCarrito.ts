// Cálculo de promos sobre el carrito del comensal, PURO y client-side: el motor
// (`aplicarPromociones`) corre en el navegador con las promos y los productos que
// ya viajaron como props, así el descuento se ve al instante sin round-trip al
// server (a diferencia del modal de pago, que sí va al server por método). El
// cobro real recalcula igual; esto es sólo para mostrar.

import {
  aplicarPromociones,
  type PromoItem,
  type PromoContexto,
  type ResultadoPromos,
} from './aplicarPromociones';
import type { Promocion } from './promociones';
import type { CartItem } from '@/features/carta/cart';
import type { ProductoMenu } from '@/features/carta/types';

export function calcularPromosCarrito(
  items: CartItem[],
  productos: ProductoMenu[],
  promos: Promocion[],
  ctx: PromoContexto = {},
): ResultadoPromos {
  const catPorProducto = new Map(productos.map((p) => [p.id, p.categoriaId]));
  const promoItems: PromoItem[] = items.map((it) => {
    const modsExtra = it.modificadores.reduce((s, m) => s + m.precioExtra, 0);
    return {
      productoId: it.productoId,
      categoriaId: catPorProducto.get(it.productoId) ?? null,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      subtotal: (it.precioUnitario + modsExtra) * it.cantidad,
    };
  });
  return aplicarPromociones(promoItems, promos, ctx);
}
