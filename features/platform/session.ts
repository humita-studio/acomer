import { cache } from 'react';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { getVerifiedUser } from '@/shared/supabase/claims';
import { getCurrentSession, type AuthUser } from '@/features/auth/session';
import { isPlatformAdminEmail } from './platformAllowlist';

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
    const user = await getVerifiedUser(supabase);

    if (!user?.email) return null;
    if (!isPlatformAdminEmail(user.email)) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        aud: user.aud,
      },
    };
  } catch (error) {
    if (isDynamicUsageError(error)) throw error;
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
    const user = await getVerifiedUser(supabase);

    if (!user) return '/login';

    if (user.mustChangePassword) {
      return '/cambiar-password';
    }

    const tenantSession = await getCurrentSession();
    if (tenantSession) return '/admin';

    if (isPlatformAdminEmail(user.email)) return '/platform';

    return '/unauthorized';
  } catch (error) {
    if (isDynamicUsageError(error)) throw error;
    console.error('[resolvePostLoginPath] Error:', error);
    return '/login';
  }
}
