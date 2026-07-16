import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { sesionesCaja } from '@/shared/db/schema';

/** Mensaje único para UI y server actions cuando falta caja abierta. */
export const MSG_CAJA_CERRADA =
  'No hay una caja abierta. Abrí la caja para cobrar en efectivo.';

/** Cualquier handle Drizzle con `.select()` (db de módulo o tx de transaction). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbExecutor = { select: (...args: any[]) => any };

/**
 * Devuelve el id de la sesión de caja Abierta del restaurante, o null.
 * Scopea siempre por `restauranteId` (el caller garantiza el tenant).
 */
export async function getSesionCajaAbiertaId(
  restauranteId: string,
  executor: DbExecutor = db,
): Promise<string | null> {
  const rows = await executor
    .select({ id: sesionesCaja.id })
    .from(sesionesCaja)
    .where(
      and(eq(sesionesCaja.restauranteId, restauranteId), eq(sesionesCaja.estado, 'Abierta')),
    )
    .orderBy(desc(sesionesCaja.abiertaAt))
    .limit(1);

  return rows[0]?.id ?? null;
}

/**
 * Exige caja abierta (cobros en efectivo).
 * @returns `{ ok: true, sesionCajaId }` o `{ ok: false, message }`.
 */
export async function requireSesionCajaAbierta(
  restauranteId: string,
  executor: DbExecutor = db,
): Promise<{ ok: true; sesionCajaId: string } | { ok: false; message: string }> {
  const sesionCajaId = await getSesionCajaAbiertaId(restauranteId, executor);
  if (!sesionCajaId) {
    return { ok: false, message: MSG_CAJA_CERRADA };
  }
  return { ok: true, sesionCajaId };
}
