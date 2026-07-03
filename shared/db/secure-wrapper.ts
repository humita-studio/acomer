import { sql } from 'drizzle-orm';
import { db } from './client';

/** Handle transaccional de Drizzle (el `tx` del callback de db.transaction). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TenantClaims {
  /** ID del usuario autenticado (lo lee `auth.uid()` en las políticas). */
  sub: string;
  /** Tenant activo (lo lee `get_current_restaurant_id()` en las políticas). */
  restaurant_id: string;
  email?: string;
}

/**
 * Ejecuta `fn` con Row Level Security REALMENTE aplicado.
 *
 * La conexión base (`DATABASE_URL`) entra como el rol `postgres`, que tiene
 * BYPASSRLS: por eso las políticas no se aplican en el resto de la app. Acá,
 * dentro de una única transacción:
 *
 *   1. `SET LOCAL ROLE authenticated` baja los privilegios a un rol SIN
 *      BYPASSRLS, sólo para esta transacción.
 *   2. Se inyectan los claims en `request.jwt.claims` de forma TRANSACTION-LOCAL
 *      (`set_config(..., true)`). El `true` es crítico: el pooler reutiliza
 *      conexiones entre requests y un setting de sesión (`false`) se filtraría
 *      al siguiente request. Con LOCAL, todo se descarta al cerrar la tx.
 *
 * Las funciones helper (`get_current_restaurant_id`, `auth.uid`) leen esos
 * claims, de modo que las políticas ya existentes escopan cada fila al tenant.
 * Si `fn` intenta tocar datos de otro restaurante, la base los oculta o rechaza
 * aunque la capa de aplicación tuviera un bug.
 *
 * Uso:
 *   const txs = await withTenant(claims, (tx) =>
 *     tx.query.transaccionesPago.findMany({ ... })
 *   );
 */
export async function withTenant<T>(
  claims: TenantClaims,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE authenticated`);

    const claimsJson = JSON.stringify({ role: 'authenticated', ...claims });
    await tx.execute(
      sql`SELECT set_config('request.jwt.claims', ${claimsJson}, true)`,
    );

    return fn(tx);
  });
}
