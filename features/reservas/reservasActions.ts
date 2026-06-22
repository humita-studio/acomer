'use server';

import { db } from '@/shared/db';
import { reservas, mesas } from '@/shared/db/schema';
import { and, eq, gte, lt, isNull, inArray } from 'drizzle-orm';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { abrirOReusarSesion, broadcastOcupacion } from '@/features/comanda/sesion-mesa-core';
import { obtenerReservasConfig } from '@/features/reservas/reservas-config-actions';
import type { ReservasConfig } from '@/features/reservas/reservas-config';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { revalidatePath } from 'next/cache';

// Estados que "ocupan" una mesa para el cálculo de disponibilidad.
const ESTADOS_OCUPAN = ['Pendiente', 'Confirmada', 'Sentada'] as const;

type EstadoReserva = 'Pendiente' | 'Confirmada' | 'Sentada' | 'NoShow' | 'Cancelada' | 'Cumplida';

// Motivo por el que un horario no tiene disponibilidad (para mensajes claros).
type MotivoSinLugar = 'inactivo' | 'cupo_dia' | 'cupo_turno' | 'sin_mesa';

function rangosSeSolapan(aInicio: Date, aFin: Date, bInicio: Date, bFin: Date) {
  return aInicio < bFin && bInicio < aFin;
}

/**
 * Chequea los cupos configurables (aforo de cubiertos por turno + tope de
 * reservas por día) contra las reservas vigentes. Cupos en null = sin límite.
 */
async function evaluarCupo(
  tenantId: string,
  inicio: Date,
  personas: number,
  config: ReservasConfig,
): Promise<{ ok: true } | { ok: false; motivo: 'cupo_dia' | 'cupo_turno' }> {
  const { maxReservasPorDia, cupoCubiertosPorTurno } = config;
  if (maxReservasPorDia == null && cupoCubiertosPorTurno == null) return { ok: true };

  // Día local [00:00, +24h) del horario pedido.
  const diaIni = new Date(inicio);
  diaIni.setHours(0, 0, 0, 0);
  const diaFin = new Date(diaIni.getTime() + 24 * 60 * 60 * 1000);

  const filas = await db
    .select({ inicio: reservas.inicio, personas: reservas.cantidadPersonas })
    .from(reservas)
    .where(
      and(
        eq(reservas.restauranteId, tenantId),
        inArray(reservas.estado, [...ESTADOS_OCUPAN]),
        gte(reservas.inicio, diaIni),
        lt(reservas.inicio, diaFin),
      ),
    );

  if (maxReservasPorDia != null && filas.length >= maxReservasPorDia) {
    return { ok: false, motivo: 'cupo_dia' };
  }

  if (cupoCubiertosPorTurno != null) {
    const t = inicio.getTime();
    const cubiertosTurno = filas
      .filter((r) => new Date(r.inicio).getTime() === t)
      .reduce((s, r) => s + r.personas, 0);
    if (cubiertosTurno + personas > cupoCubiertosPorTurno) {
      return { ok: false, motivo: 'cupo_turno' };
    }
  }

  return { ok: true };
}

/**
 * Flujo público: devuelve las mesas libres para un horario y cantidad de
 * personas. v1: chequea solape contra reservas vigentes (sin asignación óptima).
 */
export async function getDisponibilidadAction(
  tenantSlug: string,
  inicioISO: string,
  personas: number,
  duracionMin?: number,
) {
  try {
    const tenantId = await getTenantBySlug(tenantSlug);
    if (!tenantId) return { success: false, message: 'Restaurante no encontrado', mesas: [] };

    const inicio = new Date(inicioISO);
    if (Number.isNaN(inicio.getTime())) return { success: false, message: 'Fecha inválida', mesas: [] };
    if (!personas || personas < 1) {
      return { success: false, message: 'Cantidad de personas inválida', mesas: [] };
    }

    const config = await obtenerReservasConfig(tenantId);
    if (!config.activo) {
      return { success: true, mesas: [], motivo: 'inactivo' as MotivoSinLugar };
    }

    const duracion = duracionMin ?? config.duracionMinDefault;
    const fin = new Date(inicio.getTime() + duracion * 60_000);

    // Cupo configurable (aforo por turno + tope por día) antes de mirar mesas.
    const cupo = await evaluarCupo(tenantId, inicio, personas, config);
    if (!cupo.ok) {
      return { success: true, mesas: [], motivo: cupo.motivo as MotivoSinLugar };
    }

    // Mesas candidatas: activas, no sub-mesas, con capacidad suficiente.
    const candidatas = await db
      .select({ id: mesas.id, identificador: mesas.identificador, capacidad: mesas.capacidad })
      .from(mesas)
      .where(
        and(
          eq(mesas.restauranteId, tenantId),
          isNull(mesas.deletedAt),
          isNull(mesas.parentMesaId),
          gte(mesas.capacidad, personas),
        ),
      );

    if (candidatas.length === 0) return { success: true, mesas: [], motivo: 'sin_mesa' as MotivoSinLugar };

    // Reservas en una ventana amplia alrededor del horario pedido.
    const ventanaIni = new Date(inicio.getTime() - 6 * 60 * 60_000);
    const ventanaFin = new Date(fin.getTime() + 6 * 60 * 60_000);
    const reservasVentana = await db
      .select({ mesaId: reservas.mesaId, inicio: reservas.inicio, duracionMin: reservas.duracionMin })
      .from(reservas)
      .where(
        and(
          eq(reservas.restauranteId, tenantId),
          inArray(reservas.estado, [...ESTADOS_OCUPAN]),
          gte(reservas.inicio, ventanaIni),
          lt(reservas.inicio, ventanaFin),
        ),
      );

    const ocupadas = new Set<string>();
    for (const r of reservasVentana) {
      if (!r.mesaId) continue;
      const rIni = new Date(r.inicio);
      const rFin = new Date(rIni.getTime() + (r.duracionMin ?? 90) * 60_000);
      if (rangosSeSolapan(inicio, fin, rIni, rFin)) ocupadas.add(r.mesaId);
    }

    const libres = candidatas.filter((m) => !ocupadas.has(m.id));
    if (libres.length === 0) return { success: true, mesas: [], motivo: 'sin_mesa' as MotivoSinLugar };
    return { success: true, mesas: libres };
  } catch (error) {
    console.error('[getDisponibilidadAction]', error);
    return { success: false, message: 'Error al consultar disponibilidad', mesas: [] };
  }
}

type DatosReserva = {
  nombreContacto: string;
  telefono: string;
  inicioISO: string;
  personas: number;
  duracionMin?: number;
  mesaId?: string;
  notas?: string;
};

/** Flujo público: crea una reserva en estado Pendiente. */
export async function crearReservaAction(tenantSlug: string, datos: DatosReserva) {
  try {
    const tenantId = await getTenantBySlug(tenantSlug);
    if (!tenantId) return { success: false, message: 'Restaurante no encontrado' };
    if (!datos.nombreContacto?.trim() || !datos.telefono?.trim()) {
      return { success: false, message: 'Nombre y teléfono son obligatorios' };
    }
    const inicio = new Date(datos.inicioISO);
    if (Number.isNaN(inicio.getTime())) return { success: false, message: 'Fecha inválida' };
    if (!datos.personas || datos.personas < 1) {
      return { success: false, message: 'Cantidad de personas inválida' };
    }

    const config = await obtenerReservasConfig(tenantId);
    if (!config.activo) {
      return { success: false, message: 'Las reservas online no están disponibles por el momento' };
    }
    const cupo = await evaluarCupo(tenantId, inicio, datos.personas, config);
    if (!cupo.ok) {
      return {
        success: false,
        message:
          cupo.motivo === 'cupo_dia'
            ? 'No quedan reservas disponibles para ese día'
            : 'El turno elegido está completo',
      };
    }

    const [reserva] = await db
      .insert(reservas)
      .values({
        restauranteId: tenantId,
        nombreContacto: datos.nombreContacto.trim(),
        telefono: datos.telefono.trim(),
        inicio,
        duracionMin: datos.duracionMin ?? config.duracionMinDefault,
        cantidadPersonas: datos.personas,
        mesaId: datos.mesaId || null,
        notas: datos.notas?.trim() || null,
        estado: 'Pendiente',
        origen: 'online',
      })
      .returning({ id: reservas.id });

    try {
      const supabase = await createSupabaseServerClient();
      await supabase.channel(`admin_restaurant_${tenantId}`).send({
        type: 'broadcast',
        event: 'reserva_nueva',
        payload: { reservaId: reserva.id },
      });
    } catch (e) {
      console.warn('[crearReservaAction] realtime', e);
    }

    return { success: true, reservaId: reserva.id };
  } catch (error) {
    console.error('[crearReservaAction]', error);
    return { success: false, message: 'No se pudo crear la reserva' };
  }
}

/** Admin: reservas dentro de un rango [desde, hasta). */
export async function getReservasDelDiaAction(desdeISO: string, hastaISO: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageReservas')) {
      return { success: false, message: 'No autorizado', reservas: [] };
    }
    const desde = new Date(desdeISO);
    const hasta = new Date(hastaISO);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      return { success: false, message: 'Rango inválido', reservas: [] };
    }

    const filas = await db
      .select()
      .from(reservas)
      .where(
        and(
          eq(reservas.restauranteId, session.restauranteId),
          gte(reservas.inicio, desde),
          lt(reservas.inicio, hasta),
        ),
      )
      .orderBy(reservas.inicio);

    return { success: true, reservas: filas };
  } catch (error) {
    console.error('[getReservasDelDiaAction]', error);
    return { success: false, message: 'Error al cargar reservas', reservas: [] };
  }
}

/** Admin: cambia el estado de una reserva (Confirmada/Cancelada/NoShow/Cumplida). */
export async function cambiarEstadoReservaAction(reservaId: string, nuevoEstado: EstadoReserva) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageReservas')) {
      return { success: false, message: 'No autorizado' };
    }

    await db
      .update(reservas)
      .set({ estado: nuevoEstado, updatedAt: new Date() })
      .where(and(eq(reservas.id, reservaId), eq(reservas.restauranteId, session.restauranteId)));

    revalidatePath('/admin/reservas');
    return { success: true, message: 'Reserva actualizada' };
  } catch (error) {
    console.error('[cambiarEstadoReservaAction]', error);
    return { success: false, message: 'Error al actualizar la reserva' };
  }
}

/**
 * Admin: "sienta" una reserva. Abre/reusa la sesión de la mesa asignada,
 * vincula la sesión a la reserva y marca la mesa como ocupada en el plano.
 */
export async function sentarReservaAction(reservaId: string, mesaId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageReservas')) {
      return { success: false, message: 'No autorizado' };
    }

    const [mesa] = await db
      .select({ id: mesas.id, identificador: mesas.identificador })
      .from(mesas)
      .where(
        and(
          eq(mesas.id, mesaId),
          eq(mesas.restauranteId, session.restauranteId),
          isNull(mesas.deletedAt),
        ),
      )
      .limit(1);
    if (!mesa) return { success: false, message: 'Mesa no encontrada' };

    const { sesionId } = await abrirOReusarSesion(session.restauranteId, mesa);

    await db
      .update(reservas)
      .set({ estado: 'Sentada', mesaId, sesionMesaId: sesionId, updatedAt: new Date() })
      .where(and(eq(reservas.id, reservaId), eq(reservas.restauranteId, session.restauranteId)));

    await broadcastOcupacion(session.restauranteId, mesaId, true);

    revalidatePath('/admin/reservas');
    revalidatePath('/admin/plano');
    revalidatePath('/admin/mesas');
    return { success: true, sesionId };
  } catch (error) {
    console.error('[sentarReservaAction]', error);
    return { success: false, message: 'No se pudo sentar la reserva' };
  }
}
