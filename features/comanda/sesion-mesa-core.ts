import { db } from '@/shared/db';
import { sesionesMesa } from '@/shared/db/schema';
import { and, eq } from 'drizzle-orm';
import { broadcastAdminEvent } from '@/shared/supabase/broadcast';

/**
 * Helpers de sesión de mesa compartidos entre el flujo público (QR del comensal)
 * y el flujo del staff (mozo abre la mesa desde el panel). Es un módulo server-only
 * de hecho: depende de `db` y de `createSupabaseServerClient` (cookies de Next).
 */

/** Avisa al plano del local (admin) que cambió la ocupación de una mesa. */
export async function broadcastOcupacion(tenantId: string, mesaId: string, ocupada: boolean) {
  await broadcastAdminEvent(tenantId, 'ocupacion_cambiada', { mesaId, ocupada });
}

/**
 * Devuelve la sesión activa de la mesa o crea una nueva (idempotente). Si la crea,
 * avisa al plano que la mesa pasó a ocupada.
 */
export async function abrirOReusarSesion(
  tenantId: string,
  mesa: { id: string; identificador: string },
): Promise<{ sesionId: string; creada: boolean }> {
  const [activa] = await db
    .select({ id: sesionesMesa.id })
    .from(sesionesMesa)
    .where(and(eq(sesionesMesa.mesaId, mesa.id), eq(sesionesMesa.estado, 'Activa')))
    .limit(1);

  if (activa) {
    return { sesionId: activa.id, creada: false };
  }

  const [nueva] = await db
    .insert(sesionesMesa)
    .values({ restauranteId: tenantId, mesaId: mesa.id, estado: 'Activa' })
    .returning({ id: sesionesMesa.id });

  await broadcastOcupacion(tenantId, mesa.id, true);

  return { sesionId: nueva.id, creada: true };
}
