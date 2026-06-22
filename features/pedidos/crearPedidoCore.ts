import { db } from '@/shared/db';
import {
  pedidos,
  comandaItems,
  comandaItemModificadores,
  productos,
  productosPrecios,
  modificadores,
  modificadoresPrecios,
} from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Tipo de la transacción de drizzle (el `tx` del callback de db.transaction).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PedidoItemInput = {
  productoId: string;
  cantidad: number;
  modificadores: { id: string }[];
};

/**
 * Crea un pedido + comanda_items + modificadores dentro de una transacción ya
 * abierta, tomando snapshots de nombre/precio vigentes desde la DB (el cliente
 * nunca define el precio). Lo reusan `enviarPedidoAction` (desde el borrador) y
 * `crearPedidoExternoAction` (desde el carrito local del flujo externo).
 */
export async function crearPedidoConItems(
  tx: Tx,
  params: { tenantId: string; sesionMesaId: string; items: PedidoItemInput[]; notas?: string | null },
): Promise<{ pedidoId: string; totalPedido: number }> {
  const { tenantId, sesionMesaId, items, notas } = params;

  const [nuevoPedido] = await tx
    .insert(pedidos)
    .values({
      restauranteId: tenantId,
      sesionMesaId,
      estado: 'Pendiente',
      notas: notas || null,
      total: '0',
    })
    .returning({ id: pedidos.id });

  const pedidoId = nuevoPedido.id;
  let totalPedido = 0;

  for (const item of items) {
    const [prodData] = await tx
      .select({ nombre: productos.nombre })
      .from(productos)
      .where(eq(productos.id, item.productoId))
      .limit(1);
    if (!prodData) throw new Error(`Producto no encontrado: ${item.productoId}`);

    const [precioData] = await tx
      .select({ precio: productosPrecios.precio })
      .from(productosPrecios)
      .where(and(eq(productosPrecios.productoId, item.productoId), isNull(productosPrecios.vigentaHsta)))
      .limit(1);
    const precioProducto = parseFloat(precioData?.precio?.toString() || '0');

    let subtotalItem = precioProducto * item.cantidad;

    const [nuevoComandaItem] = await tx
      .insert(comandaItems)
      .values({
        restauranteId: tenantId,
        pedidoId,
        productoId: item.productoId,
        cantidad: item.cantidad.toString(),
        nombreProductoSnapshot: prodData.nombre,
        precioUnitarioSnapshot: precioProducto.toString(),
      })
      .returning({ id: comandaItems.id });

    const comandaItemId = nuevoComandaItem.id;

    for (const mod of item.modificadores ?? []) {
      const [modData] = await tx
        .select({ nombre: modificadores.nombre })
        .from(modificadores)
        .where(eq(modificadores.id, mod.id))
        .limit(1);
      if (!modData) continue;

      const [modPrecioData] = await tx
        .select({ precioExtra: modificadoresPrecios.precioExtra })
        .from(modificadoresPrecios)
        .where(
          and(eq(modificadoresPrecios.modificadorId, mod.id), isNull(modificadoresPrecios.vigentaHsta)),
        )
        .limit(1);
      const precioMod = parseFloat(modPrecioData?.precioExtra?.toString() || '0');
      subtotalItem += precioMod * item.cantidad;

      await tx.insert(comandaItemModificadores).values({
        restauranteId: tenantId,
        comandaItemId,
        modificadorId: mod.id,
        nombreModificadorSnapshot: modData.nombre,
        precioExtraSnapshot: precioMod.toString(),
      });
    }

    totalPedido += subtotalItem;
  }

  await tx.update(pedidos).set({ total: totalPedido.toString() }).where(eq(pedidos.id, pedidoId));

  return { pedidoId, totalPedido };
}
