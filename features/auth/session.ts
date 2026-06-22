import { cache } from 'react';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { perfilesEmpleados, restaurantes } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import type { RoleType } from '@/features/authorization/roles';

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
    
    // 1. Obtener el usuario autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
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
    console.error('[getCurrentSession] Error:', error);
    return null;
  }
});

/**
 * Obtiene solo el usuario autenticado, sin incluir el perfil.
 * Útil para rutas públicas que necesitan saber si hay sesión.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      aud: user.aud,
    };
  } catch (error) {
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
