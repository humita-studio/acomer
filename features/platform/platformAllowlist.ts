/**
 * Allowlist de operadores de acomer (dueños de la plataforma).
 * Fuente: env `PLATFORM_ADMIN_EMAILS` (coma-separado).
 * Puro: sin I/O — testeable en unit.
 */

/**
 * Parsea `PLATFORM_ADMIN_EMAILS` a un set normalizado (lowercase, trim).
 */
export function parsePlatformAdminEmails(raw: string | undefined | null): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * ¿El email está en la allowlist?
 * `allowlistRaw` es inyectable en tests; en runtime usa `PLATFORM_ADMIN_EMAILS`.
 */
export function isPlatformAdminEmail(
  email: string | null | undefined,
  allowlistRaw: string | undefined | null = process.env.PLATFORM_ADMIN_EMAILS,
): boolean {
  if (!email?.trim()) return false;
  return parsePlatformAdminEmails(allowlistRaw).has(email.trim().toLowerCase());
}
