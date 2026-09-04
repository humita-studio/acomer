import { sql } from 'drizzle-orm';
import { db } from '@/shared/db';

/**
 * Lecturas puntuales de `auth.users` (Supabase Auth) desde el servidor.
 *
 * Antes se usaba `auth.admin.listUsers({ perPage: 1000 })` y se filtraba en
 * memoria: traía TODOS los usuarios de la plataforma en cada invitación o
 * listado de staff, y dejaba de encontrar gente a partir del usuario 1001.
 * La conexión de Drizzle entra como `postgres`, que puede leer `auth.users`.
 *
 * Sólo servidor: nunca importar desde componentes cliente.
 */

type AuthUserRow = { id: string; email: string | null };

/** Busca un usuario de Auth por email (case-insensitive). */
export async function findAuthUserByEmail(
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const rows = (await db.execute(
    sql`select id, email from auth.users where lower(email) = ${normalized} limit 1`,
  )) as unknown as AuthUserRow[];

  const row = rows[0];
  return row ? { id: row.id, email: row.email ?? undefined } : null;
}

/** Emails de un conjunto de usuarios de Auth, indexados por id. */
export async function getEmailsByUserIds(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return map;

  const rows = (await db.execute(
    sql`select id, email from auth.users where id in ${ids}`,
  )) as unknown as AuthUserRow[];

  for (const r of rows) {
    if (r.email) map.set(r.id, r.email);
  }
  return map;
}
