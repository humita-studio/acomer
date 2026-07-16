import { cache } from 'react';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { getCurrentSession, type AuthUser } from '@/features/auth/session';
import { isPlatformAdminEmail } from './platformAllowlist';

export type PlatformSession = {
  user: AuthUser;
};

export { isPlatformAdminEmail, parsePlatformAdminEmails } from './platformAllowlist';

/**
 * Sesión de operador de plataforma (dueños de acomer).
 * No requiere perfil de empleado ni restaurante: solo Auth + allowlist.
 */
export const getPlatformSession = cache(async (): Promise<PlatformSession | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) return null;
    if (!isPlatformAdminEmail(user.email)) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        aud: user.aud,
      },
    };
  } catch (error) {
    console.error('[getPlatformSession] Error:', error);
    return null;
  }
});

/**
 * Destino post-login: contraseña temporal → cambiar-password;
 * perfil de local → /admin; solo platform admin → /platform; sino unauthorized.
 */
export async function resolvePostLoginPath(): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return '/login';

    if (user.user_metadata?.must_change_password === true) {
      return '/cambiar-password';
    }

    const tenantSession = await getCurrentSession();
    if (tenantSession) return '/admin';

    if (isPlatformAdminEmail(user.email)) return '/platform';

    return '/unauthorized';
  } catch (error) {
    console.error('[resolvePostLoginPath] Error:', error);
    return '/login';
  }
}
