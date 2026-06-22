/**
 * Motor de aplicación de promociones (función pura, sin DB).
 * Dado el detalle del pedido + el contexto del cobro (método, canal, fecha),
 * decide qué promociones aplican y cuánto descuento generan.
 *
 * Soporta los 4 tipos: porcentaje, monto_fijo, 2x1 y combo.
 */

import type { Promocion, PromoCanal, PromoMetodoPago } from './promociones';

export type PromoItem = {
  productoId: string | null;
  categoriaId: string | null;
  cantidad: number;
  /** Precio unitario base (sin adicionales). Se usa para 2x1/combo. */
  precioUnitario: number;
  /** Subtotal de la línea (cantidad × precio, con adicionales). */
  subtotal: number;
};

export type PromoContexto = {
  metodoPago?: PromoMetodoPago | null;
  canal?: PromoCanal | null;
  fecha?: Date;
  /** Promos que el cajero quitó manualmente. */
  omitirIds?: string[];
};

export type PromoAplicada = {
  id: string;
  nombre: string;
  tipo: Promocion['tipo'];
  descuento: number;
};

export type ResultadoPromos = {
  subtotal: number;
  descuento: number;
  total: number;
  aplicadas: PromoAplicada[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function vigente(p: Promocion, now: Date): boolean {
  if (p.vigenteDesde && now < new Date(p.vigenteDesde)) return false;
  if (p.vigenteHasta && now > new Date(p.vigenteHasta)) return false;
  return true;
}

function dentroDeHorario(desde: string, hasta: string, ahora: string): boolean {
  // Soporta franjas que cruzan medianoche (ej. 20:00–00:00 / 22:00–02:00).
  if (hasta <= desde) return ahora >= desde || ahora < hasta;
  return ahora >= desde && ahora < hasta;
}

function condicionesOk(p: Promocion, total: number, ctx: PromoContexto, now: Date): boolean {
  const c = p.condiciones || {};

  if (c.soloEfectivo && ctx.metodoPago !== 'efectivo') return false;
  if (c.metodosPago?.length) {
    if (!ctx.metodoPago || !c.metodosPago.includes(ctx.metodoPago)) return false;
  }
  if (c.dias?.length && !c.dias.includes(now.getDay())) return false;
  if (c.horaDesde && c.horaHasta && !dentroDeHorario(c.horaDesde, c.horaHasta, hhmm(now))) {
    return false;
  }
  if (c.canales?.length) {
    if (!ctx.canal || !c.canales.includes(ctx.canal)) return false;
  }
  if (c.montoMinimo != null && total < c.montoMinimo) return false;

  return true;
}

/** Ítems alcanzados por una promo según su alcance/targets. */
function itemsAlcanzados(p: Promocion, items: PromoItem[]): PromoItem[] {
  const targets = new Set(p.targetIds);
  if (p.tipo === 'combo') return items.filter((i) => i.productoId && targets.has(i.productoId));
  if (p.alcance === 'categoria')
    return items.filter((i) => i.categoriaId && targets.has(i.categoriaId));
  if (p.alcance === 'producto')
    return items.filter((i) => i.productoId && targets.has(i.productoId));
  return items; // pedido completo
}

function descuentoDe(p: Promocion, items: PromoItem[], total: number): number {
  switch (p.tipo) {
    case 'porcentaje': {
      const base = p.alcance === 'pedido' ? total : sum(itemsAlcanzados(p, items));
      return round2((base * p.valor) / 100);
    }
    case 'monto_fijo': {
      const base = p.alcance === 'pedido' ? total : sum(itemsAlcanzados(p, items));
      return round2(Math.min(p.valor, base));
    }
    case '2x1': {
      // Por cada línea alcanzada, 1 gratis cada 2 unidades (la unidad base).
      let d = 0;
      for (const it of itemsAlcanzados(p, items)) {
        d += Math.floor(it.cantidad / 2) * it.precioUnitario;
      }
      return round2(d);
    }
    case 'combo': {
      // Cuántos combos completos hay en el ticket (1+ de cada producto del combo).
      const productos = p.targetIds;
      if (productos.length < 2) return 0;
      let combos = Infinity;
      let precioRegular = 0;
      for (const prodId of productos) {
        const linea = items.find((i) => i.productoId === prodId);
        if (!linea) return 0; // falta un producto del combo
        combos = Math.min(combos, linea.cantidad);
        precioRegular += linea.precioUnitario;
      }
      if (!Number.isFinite(combos) || combos <= 0) return 0;
      const ahorroPorCombo = Math.max(0, precioRegular - p.valor);
      return round2(combos * ahorroPorCombo);
    }
    default:
      return 0;
  }
}

function sum(items: PromoItem[]): number {
  return items.reduce((acc, i) => acc + i.subtotal, 0);
}

/**
 * Calcula el descuento total para un pedido. Aplica todas las promos elegibles
 * (cada una calculada sobre el ticket original) y topea el descuento al total.
 */
export function aplicarPromociones(
  items: PromoItem[],
  promos: Promocion[],
  ctx: PromoContexto = {},
): ResultadoPromos {
  const subtotal = round2(items.reduce((acc, i) => acc + i.subtotal, 0));
  const now = ctx.fecha ?? new Date();
  const omitir = new Set(ctx.omitirIds ?? []);

  const elegibles = promos
    .filter((p) => p.activa && !omitir.has(p.id))
    .filter((p) => vigente(p, now))
    .filter((p) => condicionesOk(p, subtotal, ctx, now))
    .sort((a, b) => a.prioridad - b.prioridad);

  const aplicadas: PromoAplicada[] = [];
  let descuento = 0;
  for (const p of elegibles) {
    const d = descuentoDe(p, items, subtotal);
    if (d <= 0) continue;
    aplicadas.push({ id: p.id, nombre: p.nombre, tipo: p.tipo, descuento: d });
    descuento += d;
  }

  descuento = round2(Math.min(descuento, subtotal));
  return { subtotal, descuento, total: round2(subtotal - descuento), aplicadas };
}
