'use server';

import { promociones } from '@/shared/db/schema';
import { and, eq, desc, asc } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath } from 'next/cache';
import {
  type Promocion,
  type PromocionInput,
  type PromoCondiciones,
  type PromoCanal,
  type PromoMetodoPago,
  PROMO_TIPOS,
  PROMO_CANALES,
  normalizarHoraPromo,
} from './promociones';

type PromoRow = typeof promociones.$inferSelect;

function rowToPromocion(row: PromoRow): Promocion {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo as Promocion['tipo'],
    valor: Number(row.valor),
    alcance: row.alcance as Promocion['alcance'],
    targetIds: Array.isArray(row.targetIds) ? (row.targetIds as string[]) : [],
    condiciones: (row.condiciones ?? {}) as PromoCondiciones,
    vigenteDesde: row.vigenteDesde ? row.vigenteDesde.toISOString() : null,
    vigenteHasta: row.vigenteHasta ? row.vigenteHasta.toISOString() : null,
    activa: row.activa,
    prioridad: row.prioridad,
  };
}

const METODOS: PromoMetodoPago[] = ['efectivo', 'tarjeta', 'mercado_pago'];

function sanitizeCondiciones(c: PromoCondiciones | undefined): PromoCondiciones {
  const src = c ?? {};
  const out: PromoCondiciones = {};
  if (src.soloEfectivo) out.soloEfectivo = true;
  if (Array.isArray(src.metodosPago)) {
    const m = src.metodosPago.filter((x): x is PromoMetodoPago => METODOS.includes(x));
    if (m.length) out.metodosPago = Array.from(new Set(m));
  }
  if (Array.isArray(src.dias)) {
    const d = src.dias.map(Number).filter((n) => n >= 0 && n <= 6);
    if (d.length) out.dias = Array.from(new Set(d)).sort();
  }
  const hd = normalizarHoraPromo(src.horaDesde);
  const hh = normalizarHoraPromo(src.horaHasta);
  if (hd) out.horaDesde = hd;
  if (hh) out.horaHasta = hh;
  if (Array.isArray(src.canales)) {
    const ca = src.canales.filter((x): x is PromoCanal => PROMO_CANALES.includes(x));
    if (ca.length) out.canales = Array.from(new Set(ca));
  }
  if (src.montoMinimo != null && Number(src.montoMinimo) > 0) {
    out.montoMinimo = Math.round(Number(src.montoMinimo) * 100) / 100;
  }
  return out;
}

type BuildResult = { error: string } | { values: typeof promociones.$inferInsert };

/** Valida + normaliza el input en valores listos para insertar/actualizar. */
function buildValues(input: PromocionInput, tenantId: string): BuildResult {
  const nombre = (input.nombre ?? '').trim();
  if (!nombre) return { error: 'Poné un nombre para la promoción' };
  if (!PROMO_TIPOS.includes(input.tipo)) return { error: 'Tipo de promoción inválido' };

  let valor = Number(input.valor) || 0;
  if (input.tipo === 'porcentaje') {
    valor = Math.min(100, Math.max(0, valor));
    if (valor <= 0) return { error: 'El porcentaje tiene que ser mayor a 0' };
  } else if (input.tipo === 'monto_fijo' || input.tipo === 'combo') {
    valor = Math.max(0, Math.round(valor * 100) / 100);
    if (valor <= 0) return { error: 'El monto tiene que ser mayor a 0' };
  } else {
    valor = 0; // 2x1 no usa valor
  }

  const alcance = (['pedido', 'categoria', 'producto'] as const).includes(input.alcance)
    ? input.alcance
    : 'pedido';

  let targetIds = Array.isArray(input.targetIds)
    ? input.targetIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  // Cada tipo tiene su requisito de targets:
  if (input.tipo === 'combo') {
    if (targetIds.length < 2) return { error: 'Un combo necesita al menos 2 productos' };
  } else if (input.tipo === '2x1') {
    if (alcance === 'pedido' || targetIds.length === 0)
      return { error: 'Elegí la categoría o el producto del 2x1' };
  } else if (alcance !== 'pedido') {
    if (targetIds.length === 0)
      return { error: 'Elegí a qué categoría o producto aplica' };
  } else {
    targetIds = []; // descuento sobre todo el pedido
  }

  const vigenteDesde = input.vigenteDesde ? new Date(input.vigenteDesde) : null;
  const vigenteHasta = input.vigenteHasta ? new Date(input.vigenteHasta) : null;

  return {
    values: {
      restauranteId: tenantId,
      nombre: nombre.slice(0, 120),
      tipo: input.tipo,
      valor: valor.toString(),
      alcance,
      targetIds,
      condiciones: sanitizeCondiciones(input.condiciones),
      vigenteDesde: vigenteDesde && !isNaN(vigenteDesde.getTime()) ? vigenteDesde : null,
      vigenteHasta: vigenteHasta && !isNaN(vigenteHasta.getTime()) ? vigenteHasta : null,
      activa: !!input.activa,
      prioridad: Number.isFinite(input.prioridad) ? Math.round(input.prioridad) : 0,
      updatedAt: new Date(),
    },
  };
}

async function requireManager() {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canManageMenu')) return null;
  return session;
}

export async function listarPromocionesAction(): Promise<{
  success: boolean;
  message?: string;
  promociones: Promocion[];
}> {
  try {
    const session = await requireManager();
    if (!session) return { success: false, message: 'No autorizado', promociones: [] };

    const rows = await withTenant(claimsFromSession(session), (db) =>
      db
        .select()
        .from(promociones)
        .where(eq(promociones.restauranteId, session.restauranteId))
        .orderBy(desc(promociones.activa), asc(promociones.prioridad), desc(promociones.createdAt))
    );

    return { success: true, promociones: rows.map(rowToPromocion) };
  } catch (error) {
    console.error('[listarPromocionesAction]', error);
    return { success: false, message: 'Error al cargar las promociones', promociones: [] };
  }
}

export async function crearPromocionAction(input: PromocionInput) {
  try {
    const session = await requireManager();
    if (!session) return { success: false, message: 'No autorizado' };

    const built = buildValues(input, session.restauranteId);
    if ('error' in built) return { success: false, message: built.error };

    const [row] = await withTenant(claimsFromSession(session), (db) =>
      db.insert(promociones).values(built.values).returning({ id: promociones.id })
    );
    revalidatePath('/admin/promociones');
    return { success: true, id: row.id, message: 'Promoción creada' };
  } catch (error) {
    console.error('[crearPromocionAction]', error);
    return { success: false, message: 'No se pudo crear la promoción' };
  }
}

export async function actualizarPromocionAction(id: string, input: PromocionInput) {
  try {
    const session = await requireManager();
    if (!session) return { success: false, message: 'No autorizado' };

    const built = buildValues(input, session.restauranteId);
    if ('error' in built) return { success: false, message: built.error };

    // built.values incluye restauranteId = tenant actual (no cambia el dueño);
    // el WHERE igual lo scopea por seguridad.
    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(promociones)
        .set(built.values)
        .where(and(eq(promociones.id, id), eq(promociones.restauranteId, session.restauranteId)))
    );

    revalidatePath('/admin/promociones');
    return { success: true, message: 'Promoción actualizada' };
  } catch (error) {
    console.error('[actualizarPromocionAction]', error);
    return { success: false, message: 'No se pudo actualizar la promoción' };
  }
}

export async function togglePromocionAction(id: string, activa: boolean) {
  try {
    const session = await requireManager();
    if (!session) return { success: false, message: 'No autorizado' };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(promociones)
        .set({ activa, updatedAt: new Date() })
        .where(and(eq(promociones.id, id), eq(promociones.restauranteId, session.restauranteId)))
    );

    revalidatePath('/admin/promociones');
    return { success: true, message: activa ? 'Promoción activada' : 'Promoción pausada' };
  } catch (error) {
    console.error('[togglePromocionAction]', error);
    return { success: false, message: 'No se pudo cambiar el estado' };
  }
}

export async function eliminarPromocionAction(id: string) {
  try {
    const session = await requireManager();
    if (!session) return { success: false, message: 'No autorizado' };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .delete(promociones)
        .where(and(eq(promociones.id, id), eq(promociones.restauranteId, session.restauranteId)))
    );

    revalidatePath('/admin/promociones');
    return { success: true, message: 'Promoción eliminada' };
  } catch (error) {
    console.error('[eliminarPromocionAction]', error);
    return { success: false, message: 'No se pudo eliminar la promoción' };
  }
}
