import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { mesas } from '@/shared/db/schema';

/** Mesas físicas activas (no sub-mesas, no borradas). */
export async function countMesasActivas(restauranteId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(mesas)
    .where(
      and(
        eq(mesas.restauranteId, restauranteId),
        isNull(mesas.deletedAt),
        isNull(mesas.parentMesaId),
      ),
    );
  return Number(row?.c ?? 0);
}
