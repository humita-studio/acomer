'use server';

import { promociones, sesionesMesa } from '@/shared/db/schema';
import { and, eq } from 'drizzle-orm';
import { withPublicTenant } from '@/shared/db/secure-wrapper';
import { calcularCobroConPromos } from './cobroPromosActions';
import {
  type Promocion,
  type PromoCondiciones,
  type PromoMetodoPago,
  canalDeTipoSesion,
} from './promociones';

/**
 * Lecturas de promociones de cara al COMENSAL (sin sesión de staff). El carrito
 * se calcula client-side con el motor puro (`promosCarrito.ts`, instantáneo); acá
 * vive lo que sí necesita el server: la lista de promos activas y el preview de
 * la cuenta ya persistida por método de pago. Son públicas a propósito: la carta
 * y las promos son información de venta.
 */

/** Promos activas del restaurante mapeadas al tipo de dominio (para la lista). */
export async function obtenerPromocionesPublicas(tenantId: string): Promise<Promocion[]> {
  const rows = await withPublicTenant(tenantId, (db) =>
    db
      .select()
      .from(promociones)
      .where(and(eq(promociones.restauranteId, tenantId), eq(promociones.activa, true)))
  );
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

export type PreviewPromosCarrito = {
  subtotal: number;
  descuento: number;
  total: number;
  aplicadas: { id: string; nombre: string; tipo: string; descuento: number }[];
};

/**
 * Preview del descuento sobre una cuenta YA persistida (mesa/online confirmado),
 * para el modal de pago del comensal. A diferencia del carrito, acá el comensal
 * ya eligió método de pago, así que el descuento es method-aware (resuelve promos
 * tipo "efectivo −10%"). Es la versión pública (sin permiso de caja) de
 * `previsualizarCobroAction`: valida que la sesión sea del tenant. El cobro real
 * recalcula igual; esto es sólo para mostrar.
 */
export async function previsualizarCuentaComensalAction(
  sesionMesaId: string,
  tenantId: string,
  opciones: { metodoPago?: PromoMetodoPago | null } = {},
): Promise<{ success: boolean; preview?: PreviewPromosCarrito }> {
  try {
    if (!sesionMesaId || !tenantId) return { success: false };
    const sesion = await withPublicTenant(tenantId, (db) =>
      db.query.sesionesMesa.findFirst({
        where: and(eq(sesionesMesa.id, sesionMesaId), eq(sesionesMesa.restauranteId, tenantId)),
      })
    );
    if (!sesion) return { success: false };

    const res = await calcularCobroConPromos(sesionMesaId, tenantId, {
      metodoPago: opciones.metodoPago ?? null,
      canal: canalDeTipoSesion(sesion.tipo),
    });
    return {
      success: true,
      preview: {
        subtotal: res.subtotal,
        descuento: res.descuento,
        total: res.total,
        aplicadas: res.aplicadas,
      },
    };
  } catch (error) {
    console.error('[previsualizarCuentaComensalAction]', error);
    return { success: false };
  }
}
