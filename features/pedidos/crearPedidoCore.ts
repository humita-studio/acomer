import { db } from '@/shared/db';
import {
  pedidos,
  comandaItems,
  comandaItemModificadores,
  productos,
  productosPrecios,
  productoVariantes,
  productoVariantesPrecios,
  modificadores,
  modificadoresPrecios,
} from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Tipo de la transacción de drizzle (el `tx` del callback de db.transaction).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PedidoItemInput = {
  productoId: string;
  /** Presentación elegida. Obligatoria si el producto tiene variantes. */
  varianteId?: string | null;
  cantidad: number;
  modificadores: { id: string }[];
};

export type StaffItemInput = {
  /** `null` para un ítem libre (algo que no está en la carta). */
  productoId: string | null;
  /** Presentación elegida. Obligatoria si el producto tiene variantes. */
  varianteId?: string | null;
  cantidad: number;
  modificadorIds?: string[];
  /** Solo para ítems libres: nombre y precio cargados a mano. */
  nombreLibre?: string;
  precioLibre?: number;
};

/** Un ítem libre no referencia un producto: trae nombre + precio propios. */
export function esItemLibre(i: StaffItemInput): boolean {
  return !i.productoId && typeof i.nombreLibre === 'string' && i.nombreLibre.trim().length > 0;
}

/**
 * Resuelve nombre, precio unitario y variante de una línea de producto de carta,
 * tomando los valores desde la DB (el cliente nunca define el precio).
 * - Si se eligió variante: precio del ledger de la variante; nombre "Producto Variante".
 * - Si el producto tiene variantes activas y no se eligió ninguna: error (la
 *   elección es obligatoria).
 * - Si no tiene variantes: precio único vigente de productos_precios.
 */
async function resolverLineaProducto(
  tx: Tx,
  tenantId: string,
  productoId: string,
  varianteId?: string | null,
): Promise<{ varianteId: string | null; nombreSnapshot: string; precio: number }> {
  const [prodData] = await tx
    .select({ nombre: productos.nombre })
    .from(productos)
    .where(and(eq(productos.id, productoId), eq(productos.restauranteId, tenantId)))
    .limit(1);
  if (!prodData) throw new Error(`Producto no encontrado: ${productoId}`);

  if (varianteId) {
    const [variante] = await tx
      .select({ nombre: productoVariantes.nombre })
      .from(productoVariantes)
      .where(
        and(
          eq(productoVariantes.id, varianteId),
          eq(productoVariantes.productoId, productoId),
          eq(productoVariantes.restauranteId, tenantId),
          isNull(productoVariantes.deletedAt),
        ),
      )
      .limit(1);
    if (!variante) throw new Error(`Variante no encontrada para el producto: ${productoId}`);

    const [precioData] = await tx
      .select({ precio: productoVariantesPrecios.precio })
      .from(productoVariantesPrecios)
      .where(
        and(
          eq(productoVariantesPrecios.varianteId, varianteId),
          isNull(productoVariantesPrecios.vigentaHsta),
        ),
      )
      .limit(1);

    return {
      varianteId,
      nombreSnapshot: `${prodData.nombre} ${variante.nombre}`,
      precio: parseFloat(precioData?.precio?.toString() || '0'),
    };
  }

  // Sin variante elegida: si el producto tiene variantes activas, es obligatorio elegir.
  const [tieneVariante] = await tx
    .select({ id: productoVariantes.id })
    .from(productoVariantes)
    .where(
      and(
        eq(productoVariantes.productoId, productoId),
        eq(productoVariantes.restauranteId, tenantId),
        eq(productoVariantes.activo, true),
        isNull(productoVariantes.deletedAt),
      ),
    )
    .limit(1);
  if (tieneVariante) {
    throw new Error(`El producto requiere elegir una variante: ${productoId}`);
  }

  const [precioData] = await tx
    .select({ precio: productosPrecios.precio })
    .from(productosPrecios)
    .where(and(eq(productosPrecios.productoId, productoId), isNull(productosPrecios.vigentaHsta)))
    .limit(1);

  return {
    varianteId: null,
    nombreSnapshot: prodData.nombre,
    precio: parseFloat(precioData?.precio?.toString() || '0'),
  };
}

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
    const linea = await resolverLineaProducto(tx, tenantId, item.productoId, item.varianteId);

    let subtotalItem = linea.precio * item.cantidad;

    const [nuevoComandaItem] = await tx
      .insert(comandaItems)
      .values({
        restauranteId: tenantId,
        pedidoId,
        productoId: item.productoId,
        varianteId: linea.varianteId,
        cantidad: item.cantidad.toString(),
        nombreProductoSnapshot: linea.nombreSnapshot,
        precioUnitarioSnapshot: linea.precio.toString(),
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

/**
 * Igual que `crearPedidoConItems` pero soporta **ítems libres** (algo que no
 * está en la carta: `productoId` null + nombre/precio a mano). Lo usan los
 * flujos del staff que cargan pedidos desde el panel: `agregarItemsStaffAction`
 * (cuenta de una mesa) y la venta de mostrador. Toma snapshots de nombre/precio
 * vigentes desde la DB; el cliente nunca define el precio de un producto de carta.
 */
export async function crearPedidoConItemsStaff(
  tx: Tx,
  params: { tenantId: string; sesionMesaId: string; items: StaffItemInput[]; notas?: string | null },
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
    // Ítem libre: no hay producto de la carta. Se inserta con productoId null y
    // los snapshots de nombre/precio cargados a mano. No admite modificadores.
    if (esItemLibre(item)) {
      const precioLibre = Number(item.precioLibre) || 0;
      const nombreLibre = item.nombreLibre!.trim().slice(0, 120);
      await tx.insert(comandaItems).values({
        restauranteId: tenantId,
        pedidoId,
        productoId: null,
        cantidad: item.cantidad.toString(),
        nombreProductoSnapshot: nombreLibre,
        precioUnitarioSnapshot: precioLibre.toString(),
      });
      totalPedido += precioLibre * item.cantidad;
      continue;
    }

    // A esta altura no es ítem libre, así que productoId está presente.
    const productoId = item.productoId as string;

    const linea = await resolverLineaProducto(tx, tenantId, productoId, item.varianteId);

    let subtotalItem = linea.precio * item.cantidad;

    const [nuevoComandaItem] = await tx
      .insert(comandaItems)
      .values({
        restauranteId: tenantId,
        pedidoId,
        productoId,
        varianteId: linea.varianteId,
        cantidad: item.cantidad.toString(),
        nombreProductoSnapshot: linea.nombreSnapshot,
        precioUnitarioSnapshot: linea.precio.toString(),
      })
      .returning({ id: comandaItems.id });
    const comandaItemId = nuevoComandaItem.id;

    for (const modId of item.modificadorIds || []) {
      const [modData] = await tx
        .select({ nombre: modificadores.nombre })
        .from(modificadores)
        .where(and(eq(modificadores.id, modId), eq(modificadores.restauranteId, tenantId)))
        .limit(1);
      if (!modData) continue;

      const [modPrecioData] = await tx
        .select({ precioExtra: modificadoresPrecios.precioExtra })
        .from(modificadoresPrecios)
        .where(and(eq(modificadoresPrecios.modificadorId, modId), isNull(modificadoresPrecios.vigentaHsta)))
        .limit(1);
      const precioMod = parseFloat(modPrecioData?.precioExtra?.toString() || '0');
      subtotalItem += precioMod * item.cantidad;

      await tx.insert(comandaItemModificadores).values({
        restauranteId: tenantId,
        comandaItemId,
        modificadorId: modId,
        nombreModificadorSnapshot: modData.nombre,
        precioExtraSnapshot: precioMod.toString(),
      });
    }

    totalPedido += subtotalItem;
  }

  await tx.update(pedidos).set({ total: totalPedido.toString() }).where(eq(pedidos.id, pedidoId));

  return { pedidoId, totalPedido };
}
