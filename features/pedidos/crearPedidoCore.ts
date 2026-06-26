import { randomUUID } from 'node:crypto';
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
import { eq, and, isNull, inArray } from 'drizzle-orm';

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

export type LineaResuelta = {
  productoId: string;
  varianteId: string | null;
  nombreSnapshot: string;
  precio: number;
  cantidad: number;
  mods: { id: string; nombre: string; precio: number }[];
};

/**
 * Resuelve TODAS las líneas de un pedido (nombre/precio/variante + modificadores)
 * en unas pocas consultas en LOTE y en paralelo, en vez de N+1 por ítem. Las
 * lecturas van por `db` (fuera de la transacción de inserts): no necesitan la tx
 * y así no alargan el lock. Mantiene las mismas validaciones que la versión vieja
 * por ítem (producto inexistente, variante obligatoria/ inválida, precio vigente).
 */
export async function resolverLineasBulk(
  tenantId: string,
  items: PedidoItemInput[],
): Promise<LineaResuelta[]> {
  const productoIds = Array.from(new Set(items.map((i) => i.productoId)));
  const varianteIds = Array.from(
    new Set(items.map((i) => i.varianteId).filter((x): x is string => !!x)),
  );
  const modIds = Array.from(new Set(items.flatMap((i) => (i.modificadores ?? []).map((m) => m.id))));

  const [prodRows, prodPrecioRows, conVariantesRows, varRows, varPrecioRows, modRows, modPrecioRows] =
    await Promise.all([
      productoIds.length
        ? db
            .select({ id: productos.id, nombre: productos.nombre })
            .from(productos)
            .where(and(eq(productos.restauranteId, tenantId), inArray(productos.id, productoIds)))
        : Promise.resolve([] as { id: string; nombre: string }[]),
      productoIds.length
        ? db
            .select({ productoId: productosPrecios.productoId, precio: productosPrecios.precio })
            .from(productosPrecios)
            .where(and(inArray(productosPrecios.productoId, productoIds), isNull(productosPrecios.vigentaHsta)))
        : Promise.resolve([] as { productoId: string; precio: string }[]),
      productoIds.length
        ? db
            .selectDistinct({ productoId: productoVariantes.productoId })
            .from(productoVariantes)
            .where(
              and(
                eq(productoVariantes.restauranteId, tenantId),
                inArray(productoVariantes.productoId, productoIds),
                eq(productoVariantes.activo, true),
                isNull(productoVariantes.deletedAt),
              ),
            )
        : Promise.resolve([] as { productoId: string }[]),
      varianteIds.length
        ? db
            .select({
              id: productoVariantes.id,
              productoId: productoVariantes.productoId,
              nombre: productoVariantes.nombre,
            })
            .from(productoVariantes)
            .where(
              and(
                eq(productoVariantes.restauranteId, tenantId),
                inArray(productoVariantes.id, varianteIds),
                isNull(productoVariantes.deletedAt),
              ),
            )
        : Promise.resolve([] as { id: string; productoId: string; nombre: string }[]),
      varianteIds.length
        ? db
            .select({ varianteId: productoVariantesPrecios.varianteId, precio: productoVariantesPrecios.precio })
            .from(productoVariantesPrecios)
            .where(
              and(
                inArray(productoVariantesPrecios.varianteId, varianteIds),
                isNull(productoVariantesPrecios.vigentaHsta),
              ),
            )
        : Promise.resolve([] as { varianteId: string; precio: string }[]),
      modIds.length
        ? db
            .select({ id: modificadores.id, nombre: modificadores.nombre })
            .from(modificadores)
            .where(and(eq(modificadores.restauranteId, tenantId), inArray(modificadores.id, modIds)))
        : Promise.resolve([] as { id: string; nombre: string }[]),
      modIds.length
        ? db
            .select({
              modificadorId: modificadoresPrecios.modificadorId,
              precioExtra: modificadoresPrecios.precioExtra,
            })
            .from(modificadoresPrecios)
            .where(and(inArray(modificadoresPrecios.modificadorId, modIds), isNull(modificadoresPrecios.vigentaHsta)))
        : Promise.resolve([] as { modificadorId: string; precioExtra: string }[]),
    ]);

  const nombrePorProducto = new Map(prodRows.map((p) => [p.id, p.nombre]));
  const precioPorProducto = new Map(
    prodPrecioRows.map((p) => [p.productoId, parseFloat(p.precio?.toString() || '0')]),
  );
  const productosConVariantes = new Set(conVariantesRows.map((v) => v.productoId));
  const variantePorId = new Map(varRows.map((v) => [v.id, v]));
  const precioPorVariante = new Map(
    varPrecioRows.map((v) => [v.varianteId, parseFloat(v.precio?.toString() || '0')]),
  );
  const nombrePorMod = new Map(modRows.map((m) => [m.id, m.nombre]));
  const precioPorMod = new Map(
    modPrecioRows.map((m) => [m.modificadorId, parseFloat(m.precioExtra?.toString() || '0')]),
  );

  return items.map((item) => {
    const prodNombre = nombrePorProducto.get(item.productoId);
    if (prodNombre === undefined) throw new Error(`Producto no encontrado: ${item.productoId}`);

    let varianteId: string | null = null;
    let nombreSnapshot = prodNombre;
    let precio = precioPorProducto.get(item.productoId) ?? 0;

    if (item.varianteId) {
      const variante = variantePorId.get(item.varianteId);
      if (!variante || variante.productoId !== item.productoId) {
        throw new Error(`Variante no encontrada para el producto: ${item.productoId}`);
      }
      varianteId = item.varianteId;
      nombreSnapshot = `${prodNombre} ${variante.nombre}`;
      precio = precioPorVariante.get(item.varianteId) ?? 0;
    } else if (productosConVariantes.has(item.productoId)) {
      throw new Error(`El producto requiere elegir una variante: ${item.productoId}`);
    }

    const mods = (item.modificadores ?? [])
      .map((m) => {
        const nombre = nombrePorMod.get(m.id);
        if (nombre === undefined) return null; // mod inexistente: se omite (igual que antes)
        return { id: m.id, nombre, precio: precioPorMod.get(m.id) ?? 0 };
      })
      .filter((m): m is { id: string; nombre: string; precio: number } => m !== null);

    return { productoId: item.productoId, varianteId, nombreSnapshot, precio, cantidad: item.cantidad, mods };
  });
}

/**
 * Crea un pedido + comanda_items + modificadores dentro de una transacción ya
 * abierta, tomando snapshots de nombre/precio vigentes desde la DB (el cliente
 * nunca define el precio). Lo reusan `enviarPedidoAction` (desde el borrador) y
 * `crearPedidoExternoAction` (desde el carrito local del flujo externo).
 *
 * Las lecturas se resuelven en lote y en paralelo (`resolverLineasBulk`) y los
 * inserts van batcheados con ids generados en el cliente, así la transacción son
 * 3 inserts en vez de ~5 queries por ítem en serie.
 */
export async function crearPedidoConItems(
  tx: Tx,
  params: { tenantId: string; sesionMesaId: string; items: PedidoItemInput[]; notas?: string | null },
): Promise<{ pedidoId: string; totalPedido: number }> {
  const { tenantId, sesionMesaId, items, notas } = params;

  const lineas = await resolverLineasBulk(tenantId, items);

  const pedidoId = randomUUID();
  let totalPedido = 0;

  // Cada línea con su id de comanda_item (generado acá para correlacionar los
  // modificadores sin depender del orden de RETURNING).
  const itemRows = lineas.map((linea) => {
    const subtotal =
      (linea.precio + linea.mods.reduce((s, m) => s + m.precio, 0)) * linea.cantidad;
    totalPedido += subtotal;
    return { id: randomUUID(), linea };
  });

  await tx.insert(pedidos).values({
    id: pedidoId,
    restauranteId: tenantId,
    sesionMesaId,
    estado: 'Pendiente',
    notas: notas || null,
    total: totalPedido.toString(),
  });

  await tx.insert(comandaItems).values(
    itemRows.map(({ id, linea }) => ({
      id,
      restauranteId: tenantId,
      pedidoId,
      productoId: linea.productoId,
      varianteId: linea.varianteId,
      cantidad: linea.cantidad.toString(),
      nombreProductoSnapshot: linea.nombreSnapshot,
      precioUnitarioSnapshot: linea.precio.toString(),
    })),
  );

  const modRows = itemRows.flatMap(({ id, linea }) =>
    linea.mods.map((m) => ({
      restauranteId: tenantId,
      comandaItemId: id,
      modificadorId: m.id,
      nombreModificadorSnapshot: m.nombre,
      precioExtraSnapshot: m.precio.toString(),
    })),
  );
  if (modRows.length) await tx.insert(comandaItemModificadores).values(modRows);

  return { pedidoId, totalPedido };
}

/**
 * Inserta un pedido + sus items/modificadores a partir de líneas ya resueltas
 * (`LineaResuelta[]`). Útsala cuando las lecturas ya se hicieron fuera de la
 * transacción (con `resolverLineasBulk`) para no alargar el lock.
 */
export async function inserirPedidoDesdeLineas(
  tx: Tx,
  params: { tenantId: string; sesionMesaId: string; lineas: LineaResuelta[]; notas?: string | null },
): Promise<{ pedidoId: string; totalPedido: number }> {
  const { tenantId, sesionMesaId, lineas, notas } = params;

  const pedidoId = randomUUID();
  let totalPedido = 0;

  const itemRows = lineas.map((linea) => {
    const subtotal = (linea.precio + linea.mods.reduce((s, m) => s + m.precio, 0)) * linea.cantidad;
    totalPedido += subtotal;
    return { id: randomUUID(), linea };
  });

  await tx.insert(pedidos).values({
    id: pedidoId,
    restauranteId: tenantId,
    sesionMesaId,
    estado: 'Pendiente',
    notas: notas || null,
    total: totalPedido.toString(),
  });

  await tx.insert(comandaItems).values(
    itemRows.map(({ id, linea }) => ({
      id,
      restauranteId: tenantId,
      pedidoId,
      productoId: linea.productoId,
      varianteId: linea.varianteId,
      cantidad: linea.cantidad.toString(),
      nombreProductoSnapshot: linea.nombreSnapshot,
      precioUnitarioSnapshot: linea.precio.toString(),
    })),
  );

  const modRows = itemRows.flatMap(({ id, linea }) =>
    linea.mods.map((m) => ({
      restauranteId: tenantId,
      comandaItemId: id,
      modificadorId: m.id,
      nombreModificadorSnapshot: m.nombre,
      precioExtraSnapshot: m.precio.toString(),
    })),
  );
  if (modRows.length) await tx.insert(comandaItemModificadores).values(modRows);

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
