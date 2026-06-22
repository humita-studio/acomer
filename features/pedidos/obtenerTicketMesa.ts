import { db } from '@/shared/db';

export type TicketModificador = { nombre: string; precioExtra: number };

export type TicketItem = {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  modificadores: TicketModificador[];
  subtotal: number;
};

/**
 * Agrega todos los pedidos no cancelados de una sesión en una lista de items
 * (agrupando los iguales) y devuelve el total acumulado de la cuenta.
 *
 * Es la fuente única del "ticket" de una mesa: la usa tanto la carta del
 * comensal como la vista operativa del mozo en el admin.
 */
export async function obtenerTicketMesa(
  sesionMesaId: string,
): Promise<{ items: TicketItem[]; total: number }> {
  const pedidosMesa = await db.query.pedidos.findMany({
    where: (t, { eq, and, ne }) =>
      and(eq(t.sesionMesaId, sesionMesaId), ne(t.estado, 'Cancelado')),
    with: {
      items: {
        with: { modificadores: true },
      },
    },
  });

  const map = new Map<string, TicketItem>();
  for (const pedido of pedidosMesa) {
    for (const item of pedido.items) {
      const mods = item.modificadores ?? [];
      const modKey = JSON.stringify(mods);
      const key = `${item.productoId}-${modKey}`;
      const existing = map.get(key);

      const precioTotalMods = mods.reduce(
        (acc, mod) => acc + (Number(mod.precioExtraSnapshot) || 0),
        0,
      );
      const precioUnitarioBase = Number(item.precioUnitarioSnapshot || 0);
      const precioItemConMods = precioUnitarioBase + precioTotalMods;
      const itemCantidad = Number(item.cantidad);

      if (existing) {
        existing.cantidad += itemCantidad;
        existing.subtotal += itemCantidad * precioItemConMods;
      } else {
        map.set(key, {
          id: item.id,
          nombre: item.nombreProductoSnapshot || 'Producto sin nombre',
          cantidad: itemCantidad,
          precioUnitario: precioUnitarioBase,
          modificadores: mods.map((m) => ({
            nombre: m.nombreModificadorSnapshot,
            precioExtra: Number(m.precioExtraSnapshot || 0),
          })),
          subtotal: itemCantidad * precioItemConMods,
        });
      }
    }
  }

  const items = Array.from(map.values());
  const total = items.reduce((acc, it) => acc + it.subtotal, 0);
  return { items, total };
}
