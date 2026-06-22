'use server';

import { db } from '@/shared/db';
import { promociones, productos } from '@/shared/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import {
  aplicarPromociones,
  type PromoItem,
  type ResultadoPromos,
} from './aplicar-promociones';
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
