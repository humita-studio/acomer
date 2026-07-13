'use server';

import { db } from '@/shared/db';
import { mesas } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { crearStaffAlert } from '@/features/notificaciones/staffAlertsActions';
import { abrirOReusarSesion } from './sesion-mesa-core';

/**
 * Resuelve la sesión a partir del QR escaneado.
 *
 * - Si la mesa madre está dividida (tiene sub-mesas vigentes), no abre nada:
 *   devuelve `requiereSeleccion` con las opciones (madre + sub-mesas) para que
 *   el comensal elija su sector desde el mismo QR impreso.
 * - `cuentaMesaId` es el sector ya elegido (madre o una sub-mesa suya): abre esa cuenta.
 */
export async function getOrCreateSesionMesa(
  tenantSlug: string,
  qrToken: string,
  cuentaMesaId?: string,
) {
  try {
    const tenantId = await getTenantBySlug(tenantSlug);
    if (!tenantId) {
      return { success: false, message: 'Restaurante no encontrado' };
    }

    // 1. Mesa del QR escaneado (la que está impresa en la mesa física)
    const [mesa] = await db
      .select()
      .from(mesas)
      .where(and(eq(mesas.qrToken, qrToken), eq(mesas.restauranteId, tenantId)))
      .limit(1);
    if (!mesa) {
      return { success: false, message: 'Código QR de mesa inválido' };
    }

    // 2. El comensal ya eligió un sector: validar que sea esta mesa o una sub-mesa suya.
    if (cuentaMesaId) {
      const [target] = await db
        .select()
        .from(mesas)
        .where(
          and(
            eq(mesas.id, cuentaMesaId),
            eq(mesas.restauranteId, tenantId),
            isNull(mesas.deletedAt),
          ),
        )
        .limit(1);
      if (!target || (target.id !== mesa.id && target.parentMesaId !== mesa.id)) {
        return { success: false, message: 'Selección de mesa inválida' };
      }
      const { sesionId } = await abrirOReusarSesion(tenantId, target);
      return { success: true, sesionId, mesaIdentificador: target.identificador, tenantId };
    }

    // 3. Si el QR ya es el de una sub-mesa, abrir esa directamente (sin selector).
    if (mesa.parentMesaId) {
      const { sesionId } = await abrirOReusarSesion(tenantId, mesa);
      return { success: true, sesionId, mesaIdentificador: mesa.identificador, tenantId };
    }

    // 4. Mesa madre dividida: ofrecer selector (madre + sub-mesas vigentes).
    const hijos = await db
      .select({ id: mesas.id, identificador: mesas.identificador, capacidad: mesas.capacidad })
      .from(mesas)
      .where(and(eq(mesas.parentMesaId, mesa.id), isNull(mesas.deletedAt)));

    if (hijos.length > 0) {
      return {
        success: true,
        requiereSeleccion: true,
        tenantId,
        opciones: [
          { id: mesa.id, identificador: mesa.identificador, capacidad: mesa.capacidad },
          ...hijos,
        ],
      };
    }

    // 5. Mesa simple (no dividida): abrir/reusar su sesión (comportamiento de siempre).
    const { sesionId } = await abrirOReusarSesion(tenantId, mesa);
    return { success: true, sesionId, mesaIdentificador: mesa.identificador, tenantId };
  } catch (error) {
    console.error('[getOrCreateSesionMesa]', error);
    return { success: false, message: 'Error interno del servidor' };
  }
}

export async function llamarMozoAction(tenantId: string, mesaIdentificador: string) {
  try {
    if (!tenantId?.trim() || !mesaIdentificador?.trim()) {
      return { success: false, message: 'Faltan datos de la mesa' };
    }

    const mesa = mesaIdentificador.trim();
    // 1) Persistir (si el mozo no está con el panel abierto, igual la ve al
    //    abrir la campana / recargar). 2) Broadcast en vivo.
    const res = await crearStaffAlert({
      restauranteId: tenantId,
      tipo: 'llamar_mozo',
      titulo: 'Llaman al mozo',
      cuerpo: `Mesa ${mesa}`,
      href: '/admin/mesas',
      metadata: { mesaIdentificador: mesa },
    });

    if (!res.success) {
      return { success: false, message: res.message ?? 'No se pudo avisar al personal' };
    }

    return { success: true };
  } catch (error) {
    console.error('[llamarMozoAction]', error);
    return { success: false, message: 'No se pudo enviar la alerta' };
  }
}

