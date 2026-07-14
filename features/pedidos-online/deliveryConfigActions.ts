'use server';

import { db } from '@/shared/db';
import { deliveryConfig } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath } from 'next/cache';
import {
  DELIVERY_CONFIG_DEFAULT,
  type DeliveryConfig,
  type AgregadosHasta,
} from './deliveryConfig';
import { sanearZonaPoligono } from './zonaMapa';

const MODOS = ['ambos', 'takeaway', 'delivery'] as const;
const AGREGADOS = ['no', 'preparacion', 'listo'] as const;

function numNoNegativo(raw: unknown, max = 999_999): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n * 100) / 100);
}

function parseTiempoEstimado(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(24 * 60, Math.max(5, Math.round(n)));
}

function rowToConfig(row: {
  activo: boolean;
  modo: string;
  agregadosHasta: string;
  zonaEntrega?: string | null;
  zonaPoligono?: unknown;
  costoEnvio?: string | null;
  pedidoMinimo?: string | null;
  tiempoEstimadoMin?: number | null;
}): DeliveryConfig {
  return {
    activo: row.activo,
    modo: (MODOS as readonly string[]).includes(row.modo)
      ? (row.modo as DeliveryConfig['modo'])
      : DELIVERY_CONFIG_DEFAULT.modo,
    agregadosHasta: (AGREGADOS as readonly string[]).includes(row.agregadosHasta)
      ? (row.agregadosHasta as AgregadosHasta)
      : DELIVERY_CONFIG_DEFAULT.agregadosHasta,
    zonaEntrega: (row.zonaEntrega ?? '').trim().slice(0, 500),
    zonaPoligono: sanearZonaPoligono(row.zonaPoligono),
    costoEnvio: numNoNegativo(row.costoEnvio),
    pedidoMinimo: numNoNegativo(row.pedidoMinimo),
    tiempoEstimadoMin:
      row.tiempoEstimadoMin == null ? null : parseTiempoEstimado(row.tiempoEstimadoMin),
  };
}

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
    return rowToConfig(row);
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

    const zonaEntrega = (datos.zonaEntrega ?? '').trim().slice(0, 500);
    const zonaPoligono = sanearZonaPoligono(datos.zonaPoligono);
    const costoEnvio = numNoNegativo(datos.costoEnvio);
    const pedidoMinimo = numNoNegativo(datos.pedidoMinimo);
    const tiempoEstimadoMin = parseTiempoEstimado(datos.tiempoEstimadoMin);

    const valores = {
      restauranteId: session.restauranteId,
      activo: !!datos.activo,
      modo,
      agregadosHasta,
      zonaEntrega,
      zonaPoligono,
      costoEnvio: costoEnvio.toFixed(2),
      pedidoMinimo: pedidoMinimo.toFixed(2),
      tiempoEstimadoMin,
      updatedAt: new Date(),
    };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .insert(deliveryConfig)
        .values(valores)
        .onConflictDoUpdate({
          target: deliveryConfig.restauranteId,
          set: {
            activo: valores.activo,
            modo: valores.modo,
            agregadosHasta: valores.agregadosHasta,
            zonaEntrega: valores.zonaEntrega,
            zonaPoligono: valores.zonaPoligono,
            costoEnvio: valores.costoEnvio,
            pedidoMinimo: valores.pedidoMinimo,
            tiempoEstimadoMin: valores.tiempoEstimadoMin,
            updatedAt: valores.updatedAt,
          },
        })
    );

    revalidatePath('/admin/pedidos-online');
    revalidatePath('/admin/configuracion');
    return { success: true, message: 'Configuración guardada' };
  } catch (error) {
    console.error('[actualizarDeliveryConfigAction]', error);
    return { success: false, message: 'No se pudo guardar la configuración' };
  }
}
