'use server';

import { db } from '@/shared/db';
import { deliveryConfig } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';
import {
  DELIVERY_CONFIG_DEFAULT,
  type DeliveryConfig,
  type AgregadosHasta,
} from './delivery-config';

const MODOS = ['ambos', 'takeaway', 'delivery'] as const;
const AGREGADOS = ['no', 'preparacion', 'listo'] as const;

/**
 * Lectura interna (sin auth): la usan los flujos públicos (carta/checkout/
 * seguimiento, vía `db` que bypassa RLS) y el admin. Devuelve los defaults si no
 * hay fila — y también si la tabla aún no existe (antes de aplicar la migración),
 * para no romper la carta pública.
 */
export async function obtenerDeliveryConfig(tenantId: string): Promise<DeliveryConfig> {
  try {
    const [row] = await db
      .select()
      .from(deliveryConfig)
      .where(eq(deliveryConfig.restauranteId, tenantId))
      .limit(1);

    if (!row) return DELIVERY_CONFIG_DEFAULT;

    return {
      activo: row.activo,
      modo: (MODOS as readonly string[]).includes(row.modo)
        ? (row.modo as DeliveryConfig['modo'])
        : DELIVERY_CONFIG_DEFAULT.modo,
      agregadosHasta: (AGREGADOS as readonly string[]).includes(row.agregadosHasta)
        ? (row.agregadosHasta as AgregadosHasta)
        : DELIVERY_CONFIG_DEFAULT.agregadosHasta,
    };
  } catch (error) {
    console.warn('[obtenerDeliveryConfig] usando defaults', error);
    return DELIVERY_CONFIG_DEFAULT;
  }
}

/** Admin: obtiene la config (o defaults) del restaurante en sesión. */
export async function getDeliveryConfigAction() {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageDelivery')) {
      return { success: false, message: 'No autorizado', config: DELIVERY_CONFIG_DEFAULT };
    }
    const config = await obtenerDeliveryConfig(session.restauranteId);
    return { success: true, config };
  } catch (error) {
    console.error('[getDeliveryConfigAction]', error);
    return { success: false, message: 'Error al cargar la configuración', config: DELIVERY_CONFIG_DEFAULT };
  }
}

/** Admin: crea o actualiza la config de pedidos online (upsert por restaurante). */
export async function actualizarDeliveryConfigAction(datos: DeliveryConfig) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageDelivery')) {
      return { success: false, message: 'No autorizado' };
    }

    const modo = (MODOS as readonly string[]).includes(datos.modo)
      ? datos.modo
      : DELIVERY_CONFIG_DEFAULT.modo;
    const agregadosHasta = (AGREGADOS as readonly string[]).includes(datos.agregadosHasta)
      ? datos.agregadosHasta
      : DELIVERY_CONFIG_DEFAULT.agregadosHasta;

    const valores = {
      restauranteId: session.restauranteId,
      activo: !!datos.activo,
      modo,
      agregadosHasta,
      updatedAt: new Date(),
    };

    await db
      .insert(deliveryConfig)
      .values(valores)
      .onConflictDoUpdate({
        target: deliveryConfig.restauranteId,
        set: {
          activo: valores.activo,
          modo: valores.modo,
          agregadosHasta: valores.agregadosHasta,
          updatedAt: valores.updatedAt,
        },
      });

    revalidatePath('/admin/pedidos-online');
    return { success: true, message: 'Configuración guardada' };
  } catch (error) {
    console.error('[actualizarDeliveryConfigAction]', error);
    return { success: false, message: 'No se pudo guardar la configuración' };
  }
}
