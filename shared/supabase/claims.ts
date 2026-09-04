import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Usuario verificado a partir del JWT de la cookie, sin ir al servidor de Auth.
 *
 * `auth.getUser()` hace un HTTP a Supabase Auth en CADA request y server
 * action (200–400 ms desde Argentina; ~50–100 ms dentro de la región). El
 * proyecto firma los tokens con clave asimétrica (ES256, ver
 * `/auth/v1/.well-known/jwks.json`), así que `getClaims()` verifica la firma
 * localmente con el JWKS cacheado y sólo cae a la red si el token está por
 * vencer (lo refresca) o si la firma fuera simétrica.
 *
 * Trade-off aceptado: una sesión revocada sigue siendo válida hasta que vence
 * el access token (1 h por defecto en Supabase).
 */
export type VerifiedUser = {
  id: string
  email: string
  aud: string
  /** Staff con contraseña temporal: debe cambiarla antes de entrar al panel. */
  mustChangePassword: boolean
}

export async function getVerifiedUser(
  supabase: Pick<SupabaseClient, 'auth'>,
): Promise<VerifiedUser | null> {
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims || typeof claims.sub !== 'string') return null

  const aud = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
    aud: typeof aud === 'string' ? aud : 'authenticated',
    mustChangePassword: meta.must_change_password === true,
  }
}
