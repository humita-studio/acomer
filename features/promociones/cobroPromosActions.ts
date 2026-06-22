'use server';

import { db } from '@/shared/db';
import {
  promociones,
  productos,
  productosPrecios,
  productoVariantesPrecios,
  modificadoresPrecios,
} from '@/shared/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { esItemLibre, type StaffItemInput } from '@/features/pedidos/crearPedidoCore';
import {
  aplicarPromociones,
  type PromoItem,
  type ResultadoPromos,
} from './aplicarPromociones';
import type { Promocion, PromoCanal, PromoCondiciones, PromoMetodoPago } from './promociones';

/** Mapea el tipo de sesión al canal de promo. */
function canalDeSesion(tipo: string | null | undefined): PromoCanal {
  if (tipo === 'delivery') return 'delivery';
  if (tipo === 'takeaway') return 'takeaway';
  if (tipo === 'mostrador') return 'mostrador';
  return 'salon';
}

/** Promos activas del restaurante (mapeadas al tipo de dominio). */
async function obtenerPromosActivas(tenantId: string): Promise<Promocion[]> {
  const rows = await db
    .select()
    .from(promociones)
    .where(and(eq(promociones.restauranteId, tenantId), eq(promociones.activa, true)));
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo as Promocion['tipo'],
    valor: Number(r.valor),
    alcance: r.alcance as Promocion['alcance'],
    targetIds: Array.isArray(r.targetIds) ? (r.targetIds as string[]) : [],
    condiciones: (r.condiciones ?? {}) as PromoCondiciones,
    vigenteDesde: r.vigenteDesde ? r.vigenteDesde.toISOString() : null,
    vigenteHasta: r.vigenteHasta ? r.vigenteHasta.toISOString() : null,
    activa: r.activa,
    prioridad: r.prioridad,
  }));
}

/** Arma los PromoItem de una sesión (con categoría, para promos de producto/categoría). */
async function obtenerItemsParaPromos(sesionMesaId: string): Promise<PromoItem[]> {
  const pedidosMesa = await db.query.pedidos.findMany({
    where: (t, { eq, and, ne }) =>
      and(eq(t.sesionMesaId, sesionMesaId), ne(t.estado, 'Cancelado')),
    with: { items: { with: { modificadores: true } } },
  });

  const todasLasLineas = pedidosMesa.flatMap((p) => p.items);
  const productoIds = Array.from(
    new Set(todasLasLineas.map((i) => i.productoId).filter((x): x is string => !!x)),
  );

  // Mapa productoId -> categoriaId (para promos por categoría).
  const catPorProducto = new Map<string, string>();
  if (productoIds.length) {
    const prods = await db
      .select({ id: productos.id, categoriaId: productos.categoriaId })
      .from(productos);
    for (const pr of prods) {
      if (productoIds.includes(pr.id)) catPorProducto.set(pr.id, pr.categoriaId);
    }
  }

  return todasLasLineas.map((item) => {
    const mods = item.modificadores ?? [];
    const precioMods = mods.reduce((acc, m) => acc + (Number(m.precioExtraSnapshot) || 0), 0);
    const precioUnitario = Number(item.precioUnitarioSnapshot) || 0;
    const cantidad = Number(item.cantidad) || 0;
    return {
      productoId: item.productoId ?? null,
      categoriaId: item.productoId ? catPorProducto.get(item.productoId) ?? null : null,
      cantidad,
      precioUnitario,
      subtotal: (precioUnitario + precioMods) * cantidad,
    } satisfies PromoItem;
  });
}

/**
 * Arma los PromoItem desde un carrito local (StaffItemInput), resolviendo precio
 * base y categoría vigentes desde la DB — los mismos snapshots que persiste
 * `crearPedidoConItemsStaff`, así el subtotal del preview coincide con el total
 * cobrado. Lo usan el preview y el cobro de la venta de mostrador (ítems que aún
 * no están persistidos, a diferencia de `obtenerItemsParaPromos`).
 */
async function construirPromoItemsStaff(
  tenantId: string,
  items: StaffItemInput[],
): Promise<PromoItem[]> {
  const productoIds = Array.from(
    new Set(items.map((i) => i.productoId).filter((x): x is string => !!x)),
  );
  const varianteIds = Array.from(
    new Set(items.map((i) => i.varianteId).filter((x): x is string => !!x)),
  );
  const modIds = Array.from(new Set(items.flatMap((i) => i.modificadorIds ?? [])));

  const [prodRows, precioRows, variantePrecioRows, modPrecioRows] = await Promise.all([
    productoIds.length
      ? db
          .select({ id: productos.id, categoriaId: productos.categoriaId })
          .from(productos)
          .where(and(eq(productos.restauranteId, tenantId), inArray(productos.id, productoIds)))
      : Promise.resolve([] as { id: string; categoriaId: string }[]),
    productoIds.length
      ? db
          .select({ productoId: productosPrecios.productoId, precio: productosPrecios.precio })
          .from(productosPrecios)
          .where(
            and(inArray(productosPrecios.productoId, productoIds), isNull(productosPrecios.vigentaHsta)),
          )
      : Promise.resolve([] as { productoId: string; precio: string }[]),
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
          .select({
            modificadorId: modificadoresPrecios.modificadorId,
            precioExtra: modificadoresPrecios.precioExtra,
          })
          .from(modificadoresPrecios)
          .where(
            and(inArray(modificadoresPrecios.modificadorId, modIds), isNull(modificadoresPrecios.vigentaHsta)),
          )
      : Promise.resolve([] as { modificadorId: string; precioExtra: string }[]),
  ]);

  const catPorProducto = new Map(prodRows.map((p) => [p.id, p.categoriaId]));
  const precioPorProducto = new Map(precioRows.map((p) => [p.productoId, Number(p.precio) || 0]));
  const precioPorVariante = new Map(
    variantePrecioRows.map((v) => [v.varianteId, Number(v.precio) || 0]),
  );
  const precioPorMod = new Map(modPrecioRows.map((m) => [m.modificadorId, Number(m.precioExtra) || 0]));

  return items.map((item) => {
    const cantidad = Number(item.cantidad) || 0;
    if (esItemLibre(item)) {
      const precio = Number(item.precioLibre) || 0;
      return {
        productoId: null,
        categoriaId: null,
        cantidad,
        precioUnitario: precio,
        subtotal: precio * cantidad,
      } satisfies PromoItem;
    }
    const productoId = item.productoId as string;
    // Si la línea tiene variante, su precio (absoluto) manda sobre el base.
    const precioBase = item.varianteId
      ? precioPorVariante.get(item.varianteId) ?? 0
      : precioPorProducto.get(productoId) ?? 0;
    const precioMods = (item.modificadorIds ?? []).reduce(
      (acc, id) => acc + (precioPorMod.get(id) ?? 0),
      0,
    );
    return {
      productoId,
      categoriaId: catPorProducto.get(productoId) ?? null,
      cantidad,
      precioUnitario: precioBase,
      subtotal: (precioBase + precioMods) * cantidad,
    } satisfies PromoItem;
  });
}

/**
 * Como `calcularCobroConPromos` pero para un carrito local todavía sin persistir
 * (venta de mostrador). Resuelve precios desde la DB y corre el motor.
 */
export async function calcularPromosStaff(
  tenantId: string,
  items: StaffItemInput[],
  opts: { metodoPago?: PromoMetodoPago | null; canal?: PromoCanal; omitirIds?: string[] },
): Promise<ResultadoPromos & { aplicadasIds: string[] }> {
  const [promoItems, promos] = await Promise.all([
    construirPromoItemsStaff(tenantId, items),
    obtenerPromosActivas(tenantId),
  ]);
  const res = aplicarPromociones(promoItems, promos, {
    metodoPago: opts.metodoPago ?? null,
    canal: opts.canal ?? null,
    omitirIds: opts.omitirIds,
  });
  return { ...res, aplicadasIds: res.aplicadas.map((a) => a.id) };
}

/**
 * Cálculo "core" reutilizable: ítems + promos + contexto → resultado.
 * Lo usan tanto la preview (UI) como el cobro real.
 */
export async function calcularCobroConPromos(
  sesionMesaId: string,
  tenantId: string,
  opts: { metodoPago?: PromoMetodoPago | null; canal?: PromoCanal; omitirIds?: string[] },
): Promise<ResultadoPromos & { aplicadasIds: string[] }> {
  const [items, promos] = await Promise.all([
    obtenerItemsParaPromos(sesionMesaId),
    obtenerPromosActivas(tenantId),
  ]);
  const res = aplicarPromociones(items, promos, {
    metodoPago: opts.metodoPago ?? null,
    canal: opts.canal ?? null,
    omitirIds: opts.omitirIds,
  });
  return { ...res, aplicadasIds: res.aplicadas.map((a) => a.id) };
}

/**
 * Preview para la UI de cobro: dado el método elegido (y promos quitadas),
 * devuelve subtotal, descuento, total y qué promos se aplican.
 */
export async function previsualizarCobroAction(
  sesionMesaId: string,
  opts: { metodoPago?: PromoMetodoPago | null; omitirIds?: string[] } = {},
) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canProcessPayments')) {
      return { success: false as const, message: 'No autorizado' };
    }

    const sesion = await db.query.sesionesMesa.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.id, sesionMesaId), eq(t.restauranteId, session.restauranteId)),
    });
    if (!sesion) return { success: false as const, message: 'Sesión no encontrada' };

    const res = await calcularCobroConPromos(sesionMesaId, session.restauranteId, {
      metodoPago: opts.metodoPago ?? null,
      canal: canalDeSesion(sesion.tipo),
      omitirIds: opts.omitirIds,
    });

    return { success: true as const, ...res };
  } catch (error) {
    console.error('[previsualizarCobroAction]', error);
    return { success: false as const, message: 'No se pudo calcular el cobro' };
  }
}
