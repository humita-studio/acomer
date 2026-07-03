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
 * Núcleo de la ejecución con RLS: dentro de una única transacción baja el rol a
 * uno SIN BYPASSRLS e inyecta los claims de forma TRANSACTION-LOCAL.
 *
 * La conexión base (`DATABASE_URL`) entra como el rol `postgres`, que tiene
 * BYPASSRLS: por eso las políticas no se aplican en el resto de la app. Acá:
 *   1. `SET LOCAL ROLE <role>` baja los privilegios sólo para esta transacción.
 *   2. `set_config('request.jwt.claims', ..., true)` inyecta los claims. El
 *      `true` (LOCAL) es crítico: el pooler reutiliza conexiones entre requests
 *      y un setting de sesión (`false`) se filtraría al siguiente request. Con
 *      LOCAL, todo se descarta al cerrar la tx.
 *
 * Las funciones helper (`get_current_restaurant_id`, `auth.uid`) leen esos
 * claims, así que las políticas ya existentes escopan cada fila al tenant.
 */
async function runWithClaims<T>(
  role: 'authenticated' | 'anon',
  claims: Record<string, unknown>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // El nombre del rol no puede ir parametrizado (es un identificador). Se
    // ramifica sobre literales controlados, nunca sobre entrada del usuario.
    if (role === 'anon') {
      await tx.execute(sql`SET LOCAL ROLE anon`);
    } else {
      await tx.execute(sql`SET LOCAL ROLE authenticated`);
    }

    const claimsJson = JSON.stringify({ role, ...claims });
    await tx.execute(
      sql`SELECT set_config('request.jwt.claims', ${claimsJson}, true)`,
    );

    return fn(tx);
  });
}

/**
 * Ejecuta `fn` con RLS aplicado en nombre de un EMPLEADO autenticado (rol
 * `authenticated`). Los claims salen de la sesión (ver `claimsFromSession`).
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
  return runWithClaims('authenticated', { ...claims }, fn);
}

/**
 * Ejecuta `fn` con RLS aplicado para un FLUJO PÚBLICO del comensal (rol `anon`),
 * sin sesión de empleado. El tenant se resuelve desde el subdominio, no desde una
 * sesión, y es el único claim inyectado: las políticas públicas escopan por
 * `restaurant_id` (las que dependen de `auth.uid()` no aplican al comensal).
 *
 * `anon` no tiene BYPASSRLS, así que un `restauranteId` equivocado sólo puede
 * tocar datos públicos de ese otro tenant (lo mismo que visitar su web), nunca
 * datos sensibles ni de otro local.
 *
 * Uso:
 *   const productos = await withPublicTenant(tenantId, (tx) =>
 *     tx.select().from(productos).where(...)
 *   );
 */
export async function withPublicTenant<T>(
  restauranteId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runWithClaims('anon', { restaurant_id: restauranteId }, fn);
}
