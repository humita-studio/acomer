'use server';

import { db } from '@/shared/db';
import { mesas, sesionesMesa } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { createSupabaseServerClient } from '@/shared/supabase/server';

export async function getOrCreateSesionMesa(tenantSlug: string, qrToken: string) {
  try {
    const tenantId = await getTenantBySlug(tenantSlug);
    if (!tenantId) {
      return { success: false, message: 'Restaurante no encontrado' };
    }

    // 1. Verificar que la mesa existe y pertenece al restaurante
    const mesaData = await db
      .select()
      .from(mesas)
      .where(
        and(
          eq(mesas.qrToken, qrToken),
          eq(mesas.restauranteId, tenantId)
        )
      )
      .limit(1);

    const mesa = mesaData[0];
    if (!mesa) {
      return { success: false, message: 'Código QR de mesa inválido' };
    }

    // 2. Buscar si hay una sesión activa para esta mesa
    const sesionActiva = await db
      .select()
      .from(sesionesMesa)
      .where(
        and(
          eq(sesionesMesa.mesaId, mesa.id),
          eq(sesionesMesa.estado, 'Activa')
        )
      )
      .limit(1);

    if (sesionActiva[0]) {
      return { 
        success: true, 
        sesionId: sesionActiva[0].id, 
        mesaIdentificador: mesa.identificador,
        tenantId
      };
    }

    // 3. Si no hay sesión activa, crear una nueva
    const nuevaSesion = await db.insert(sesionesMesa).values({
      restauranteId: tenantId,
      mesaId: mesa.id,
      estado: 'Activa',
    }).returning({ id: sesionesMesa.id });

    // Avisar al panel admin (plano del local) que la mesa pasó a ocupada
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.channel(`admin_restaurant_${tenantId}`).send({
        type: 'broadcast',
        event: 'ocupacion_cambiada',
        payload: { mesaId: mesa.id, ocupada: true },
      });
    } catch (e) {
      console.error('[getOrCreateSesionMesa] broadcast ocupacion', e);
    }

    return {
      success: true, 
      sesionId: nuevaSesion[0].id,
      mesaIdentificador: mesa.identificador,
      tenantId
    };

  } catch (error) {
    console.error('[getOrCreateSesionMesa]', error);
    return { success: false, message: 'Error interno del servidor' };
  }
}

export async function llamarMozoAction(tenantId: string, mesaIdentificador: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Enviar broadcast al canal del restaurante donde escuchan mozos/admins
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);
    
    await channel.send({
      type: 'broadcast',
      event: 'alerta_mesa',
      payload: {
        tipo: 'llamar_mozo',
        mesaIdentificador,
        timestamp: new Date().toISOString()
      }
    });

    return { success: true };
  } catch (error) {
    console.error('[llamarMozoAction]', error);
    return { success: false, message: 'No se pudo enviar la alerta' };
  }
}

