'use server';

import { db } from '@/shared/db';
import { reservasConfig } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath } from 'next/cache';
import { RESERVAS_CONFIG_DEFAULT, horaAMin, type ReservasConfig, type Turno } from './reservasConfig';

/** 'HH:MM' válido y normalizado a 2 dígitos, o null. */
function normalizarHora(h: unknown): string | null {
  if (typeof h !== 'string') return null;
  const min = horaAMin(h);
  if (min == null) return null;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * Parsea el JSONB de turnos a `Turno[]`. Tolera el shape viejo (array de
 * strings 'HH:MM') devolviendo los turnos por defecto, así una fila sin migrar
 * no rompe la lectura.
 */
function parsearTurnos(raw: unknown): Turno[] {
  if (!Array.isArray(raw) || raw.length === 0) return RESERVAS_CONFIG_DEFAULT.turnos;
  // Shape viejo: lista de 'HH:MM'. Adoptamos el default con nombre/rango.
  if (typeof raw[0] === 'string') return RESERVAS_CONFIG_DEFAULT.turnos;

  const turnos: Turno[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const desde = normalizarHora(o.desde);
    const hasta = normalizarHora(o.hasta);
    const nombre = typeof o.nombre === 'string' ? o.nombre.trim() : '';
    if (!nombre || !desde || !hasta) continue;
    turnos.push({ nombre, desde, hasta, activo: o.activo !== false });
  }
  return turnos.length > 0 ? turnos : RESERVAS_CONFIG_DEFAULT.turnos;
}

/**
 * Lectura interna de la config (sin auth): la usa tanto el flujo público
 * (getDisponibilidad/crearReserva, vía `db` que bypassa RLS) como el admin.
 * Devuelve los defaults si no hay fila.
 */
export async function obtenerReservasConfig(tenantId: string): Promise<ReservasConfig> {
  const [row] = await db
    .select()
    .from(reservasConfig)
    .where(eq(reservasConfig.restauranteId, tenantId))
    .limit(1);

  if (!row) return RESERVAS_CONFIG_DEFAULT;

  return {
    activo: row.activo,
    turnos: parsearTurnos(row.turnos),
    duracionMinDefault: row.duracionMinDefault,
    anticipacionMinMin: row.anticipacionMinMin ?? RESERVAS_CONFIG_DEFAULT.anticipacionMinMin,
    cupoCubiertosPorTurno: row.cupoCubiertosPorTurno ?? null,
    maxReservasPorDia: row.maxReservasPorDia ?? null,
  };
}

/** Admin: obtiene la config (o defaults) del restaurante en sesión. */
export async function getReservasConfigAction() {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageReservas')) {
      return { success: false, message: 'No autorizado', config: RESERVAS_CONFIG_DEFAULT };
    }
    const config = await obtenerReservasConfig(session.restauranteId);
    return { success: true, config };
  } catch (error) {
    console.error('[getReservasConfigAction]', error);
    return { success: false, message: 'Error al cargar la configuración', config: RESERVAS_CONFIG_DEFAULT };
  }
}

/** Sanea la lista de turnos: nombre + rango válidos; descarta los incompletos. */
function sanearTurnos(turnos: Turno[]): Turno[] {
  const out: Turno[] = [];
  for (const t of turnos ?? []) {
    const desde = normalizarHora(t?.desde);
    const hasta = normalizarHora(t?.hasta);
    const nombre = typeof t?.nombre === 'string' ? t.nombre.trim() : '';
    if (!nombre || !desde || !hasta) continue;
    out.push({ nombre, desde, hasta, activo: t.activo !== false });
  }
  return out;
}

/** Admin: crea o actualiza la config de reservas (upsert por restaurante). */
export async function actualizarReservasConfigAction(datos: ReservasConfig) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageReservas')) {
      return { success: false, message: 'No autorizado' };
    }

    const turnos = sanearTurnos(datos.turnos);
    if (turnos.length === 0) {
      return { success: false, message: 'Definí al menos un turno' };
    }
    if (!turnos.some((t) => t.activo)) {
      return { success: false, message: 'Activá al menos un turno' };
    }

    const duracion = Number.isFinite(datos.duracionMinDefault)
      ? Math.max(15, Math.round(datos.duracionMinDefault))
      : 90;
    const anticipacion = Number.isFinite(datos.anticipacionMinMin)
      ? Math.max(0, Math.round(datos.anticipacionMinMin))
      : 0;
    const cupoTurno =
      datos.cupoCubiertosPorTurno == null || datos.cupoCubiertosPorTurno <= 0
        ? null
        : Math.round(datos.cupoCubiertosPorTurno);
    const maxDia =
      datos.maxReservasPorDia == null || datos.maxReservasPorDia <= 0 ? null : Math.round(datos.maxReservasPorDia);

    const valores = {
      restauranteId: session.restauranteId,
      activo: !!datos.activo,
      turnos,
      duracionMinDefault: duracion,
      anticipacionMinMin: anticipacion,
      cupoCubiertosPorTurno: cupoTurno,
      maxReservasPorDia: maxDia,
      updatedAt: new Date(),
    };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .insert(reservasConfig)
        .values(valores)
        .onConflictDoUpdate({
          target: reservasConfig.restauranteId,
          set: {
            activo: valores.activo,
            turnos: valores.turnos,
            duracionMinDefault: valores.duracionMinDefault,
            anticipacionMinMin: valores.anticipacionMinMin,
            cupoCubiertosPorTurno: valores.cupoCubiertosPorTurno,
            maxReservasPorDia: valores.maxReservasPorDia,
            updatedAt: valores.updatedAt,
          },
        })
    );

    revalidatePath('/admin/reservas');
    return { success: true, message: 'Configuración guardada' };
  } catch (error) {
    console.error('[actualizarReservasConfigAction]', error);
    return { success: false, message: 'No se pudo guardar la configuración' };
  }
}
