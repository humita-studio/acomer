/**
 * Rate limit en memoria por proceso (best-effort).
 * Suficiente para un solo instance / serverless warm; no es cluster-wide.
 * Clave: acción + IP o tenant.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; message: string };

/**
 * @param key identificador (p. ej. `reserva:1.2.3.4` o `pedido:tenantId:ip`)
 * @param limit máximo de hits en la ventana
 * @param windowMs ventana en ms
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return {
      ok: false,
      retryAfterSec,
      message: `Demasiados intentos. Probá de nuevo en ${retryAfterSec}s.`,
    };
  }
  return { ok: true };
}

/** Limpia buckets vencidos (tests / higiene ocasional). */
export function pruneRateLimitBuckets(now = Date.now()): void {
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/** Solo tests. */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
