/**
 * Traduce mensajes de error de Supabase Auth a español claro para el usuario.
 * Si no hay match, devuelve un mensaje genérico (nunca el stack crudo).
 */

const REGLAS: Array<{ test: RegExp; mensaje: string }> = [
  {
    test: /invalid login credentials|invalid credentials|wrong password|invalid email or password/i,
    mensaje: 'Email o contraseña incorrectos.',
  },
  {
    test: /email not confirmed/i,
    mensaje: 'Confirmá tu email antes de ingresar.',
  },
  {
    test: /user already registered|already been registered|already exists/i,
    mensaje: 'Ese email ya tiene una cuenta. Iniciá sesión.',
  },
  {
    test: /password should be at least|password is known|weak password|too short/i,
    mensaje: 'La contraseña es demasiado corta o insegura. Usá al menos 8 caracteres.',
  },
  {
    test: /same password|different from the old/i,
    mensaje: 'La nueva contraseña tiene que ser distinta a la actual.',
  },
  {
    test: /new password should be different/i,
    mensaje: 'La nueva contraseña tiene que ser distinta a la actual.',
  },
  {
    test: /rate limit|only request this after|for security purposes/i,
    mensaje: 'Demasiados intentos. Esperá un momento y probá de nuevo.',
  },
  {
    test: /user not found|unable to find user/i,
    mensaje: 'No encontramos una cuenta con ese email.',
  },
  {
    test: /network|fetch failed|failed to fetch/i,
    mensaje: 'No pudimos conectar. Revisá tu internet e intentá de nuevo.',
  },
  {
    test: /session|jwt|refresh token|not authenticated|auth session missing/i,
    mensaje: 'Tu sesión expiró. Volvé a iniciar sesión.',
  },
  {
    test: /email rate limit|over_email_send_rate_limit/i,
    mensaje: 'Ya enviamos varios emails. Revisá tu bandeja o esperá unos minutos.',
  },
];

export function traducirErrorAuth(error: unknown, fallback?: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';

  if (raw) {
    for (const { test, mensaje } of REGLAS) {
      if (test.test(raw)) return mensaje;
    }
  }

  return fallback ?? 'Algo salió mal. Probá de nuevo.';
}

/** Flag en user_metadata: el staff debe elegir contraseña propia al primer login. */
export const META_MUST_CHANGE_PASSWORD = 'must_change_password';

export function userMustChangePassword(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return user?.user_metadata?.[META_MUST_CHANGE_PASSWORD] === true;
}
