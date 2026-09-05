import { and, eq } from 'drizzle-orm';
import { reservas } from '@/shared/db/schema';

/** Cualquier handle Drizzle con `.update()` (db de módulo o tx de transaction). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbExecutor = { update: (...args: any[]) => any };

/**
 * Cimiento de reservas: al cerrar la sesión de una mesa (cobro aprobado,
 * webhook de MP, "liberar mesa"), las reservas que estaban **Sentadas** en esa
 * sesión pasan a **Cumplida**. Sin esto quedaban "Sentada" para siempre y la
 * agenda mostraba como en curso mesas que ya se habían pagado e ido.
 *
 * Idempotente y scopeado por tenant. Usar dentro de la misma transacción que
 * cierra la sesión.
 */
export async function marcarReservasCumplidas(
  executor: DbExecutor,
  restauranteId: string,
  sesionMesaId: string,
): Promise<void> {
  await executor
    .update(reservas)
    .set({ estado: 'Cumplida', updatedAt: new Date() })
    .where(
      and(
        eq(reservas.sesionMesaId, sesionMesaId),
        eq(reservas.restauranteId, restauranteId),
        eq(reservas.estado, 'Sentada'),
      ),
    );
}
