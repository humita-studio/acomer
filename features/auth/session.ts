import { cache } from 'react';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { getVerifiedUser } from '@/shared/supabase/claims';
import { perfilesEmpleados, restaurantes } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import type { RoleType } from '@/features/authorization/roles';

/**
 * Next lanza este error cuando una ruta que intenta prerenderizarse usa
 * `cookies()`. Hay que dejarlo pasar: así Next marca la ruta como dinámica en
 * vez de que nosotros lo loguéemos como si fuera un fallo de sesión.
 */
function isDynamicUsageError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    (error as { digest?: unknown }).digest === 'DYNAMIC_SERVER_USAGE'
  );
}

export interface AuthUser {
  id: string;
  email: string;
  aud: string;
}

export interface AuthSession {
  user: AuthUser;
  role: RoleType;
  restauranteId: string;
  perfilId: string;
  nombreRestaurante: string;
  slugRestaurante: string;
}

/**
 * Obtiene la sesión actual del usuario y su perfil de empleado.
 * Retorna null si no hay sesión o no existe perfil de empleado.
 */
export const getCurrentSession = cache(async (): Promise<AuthSession | null> => {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Usuario verificado por firma del JWT (sin HTTP a Supabase Auth).
    const user = await getVerifiedUser(supabase);
    if (!user) {
      return null;
    }

    // 2. Obtener el perfil del empleado (role + restaurante)
    const perfil = await db
      .select({
        id: perfilesEmpleados.id,
        rol: perfilesEmpleados.rol,
        restauranteId: perfilesEmpleados.restauranteId,
        activo: perfilesEmpleados.activo,
        nombre: restaurantes.nombre,
        slug: restaurantes.slug,
      })
      .from(perfilesEmpleados)
      .innerJoin(restaurantes, eq(perfilesEmpleados.restauranteId, restaurantes.id))
      .where(eq(perfilesEmpleados.userId, user.id))
      .limit(1);

    if (!perfil[0] || !perfil[0].activo) {
      return null;
    }

    const perfil_data = perfil[0];

    return {
      user: {
        id: user.id,
        email: user.email || '',
        aud: user.aud,
      },
      role: perfil_data.rol as RoleType,
      restauranteId: perfil_data.restauranteId,
      perfilId: perfil_data.id,
      nombreRestaurante: perfil_data.nombre,
      slugRestaurante: perfil_data.slug,
    };
  } catch (error) {
    if (isDynamicUsageError(error)) throw error;
    console.error('[getCurrentSession] Error:', error);
    return null;
  }
});

/**
 * Construye los claims para `withTenant` a partir de la sesión: el tenant y el
 * usuario con los que RLS escopa cada query. Nunca depender de un tenantId que
 * venga del cliente.
 */
export function claimsFromSession(session: AuthSession) {
  return {
    sub: session.user.id,
    restaurant_id: session.restauranteId,
    email: session.user.email,
  };
}

/**
 * Obtiene solo el usuario autenticado, sin incluir el perfil.
 * Útil para rutas públicas que necesitan saber si hay sesión.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getVerifiedUser(supabase);
    if (!user) {
      return null;
    }

    return { id: user.id, email: user.email, aud: user.aud };
  } catch (error) {
    if (isDynamicUsageError(error)) throw error;
    console.error('[getAuthUser] Error:', error);
    return null;
  }
}

/**
 * Cierra la sesión del usuario.
 */
export async function signOut() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error('[signOut] Error:', error);
  }
}
