'use server';

import { db } from '@/shared/db';
import { reservasConfig } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';
import { RESERVAS_CONFIG_DEFAULT, type ReservasConfig } from './reservas-config';

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

  const turnos = Array.isArray(row.turnos) ? (row.turnos as string[]) : RESERVAS_CONFIG_DEFAULT.turnos;
  return {
    activo: row.activo,
    turnos,
    duracionMinDefault: row.duracionMinDefault,
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

function normalizarHora(h: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Admin: crea o actualiza la config de reservas (upsert por restaurante). */
export async function actualizarReservasConfigAction(datos: ReservasConfig) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageReservas')) {
      return { success: false, message: 'No autorizado' };
    }

    // Sanear/ordenar turnos (únicos, válidos, ordenados).
    const turnos = Array.from(
      new Set((datos.turnos ?? []).map(normalizarHora).filter((h): h is string => h !== null)),
    ).sort();
    if (turnos.length === 0) {
      return { success: false, message: 'Definí al menos un turno' };
    }

    const duracion = Number.isFinite(datos.duracionMinDefault) ? Math.max(15, Math.round(datos.duracionMinDefault)) : 90;
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
      cupoCubiertosPorTurno: cupoTurno,
      maxReservasPorDia: maxDia,
      updatedAt: new Date(),
    };

    await db
      .insert(reservasConfig)
      .values(valores)
      .onConflictDoUpdate({
        target: reservasConfig.restauranteId,
        set: {
          activo: valores.activo,
          turnos: valores.turnos,
          duracionMinDefault: valores.duracionMinDefault,
          cupoCubiertosPorTurno: valores.cupoCubiertosPorTurno,
          maxReservasPorDia: valores.maxReservasPorDia,
          updatedAt: valores.updatedAt,
        },
      });

    revalidatePath('/admin/reservas');
    return { success: true, message: 'Configuración guardada' };
  } catch (error) {
    console.error('[actualizarReservasConfigAction]', error);
    return { success: false, message: 'No se pudo guardar la configuración' };
  }
}
