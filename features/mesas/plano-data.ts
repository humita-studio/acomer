import { db } from '@/shared/db';
import { ambientes, mesas } from '@/shared/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';

/**
 * Garantiza que el restaurante tenga al menos un ambiente y que ninguna mesa
 * quede sin asignar. Idempotente: se llama desde el loader de /admin/plano.
 *
 * - Si no hay ningún ambiente, crea "Salón" (orden 0).
 * - Toda mesa con ambiente_id NULL se asigna al ambiente por defecto
 *   (el de menor orden), de modo que las mesas creadas desde /admin/mesas
 *   aparezcan automáticamente en el plano.
 */
export async function ensureAmbientePorDefecto(restauranteId: string): Promise<string> {
  const existentes = await db
    .select({ id: ambientes.id })
    .from(ambientes)
    .where(and(eq(ambientes.restauranteId, restauranteId), isNull(ambientes.deletedAt)))
    .orderBy(asc(ambientes.orden), asc(ambientes.createdAt));

  let defaultId: string;
  if (existentes.length === 0) {
    const [creado] = await db
      .insert(ambientes)
      .values({ restauranteId, nombre: 'Salón', orden: 0 })
      .returning({ id: ambientes.id });
    defaultId = creado.id;
  } else {
    defaultId = existentes[0].id;
  }

  // Reubicar mesas sin ambiente al ambiente por defecto
  await db
    .update(mesas)
    .set({ ambienteId: defaultId })
    .where(
      and(
        eq(mesas.restauranteId, restauranteId),
        isNull(mesas.ambienteId),
        isNull(mesas.deletedAt)
      )
    );

  return defaultId;
}
