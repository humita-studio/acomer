import { headers } from 'next/headers';

/**
 * Mejor esfuerzo de IP del caller (Vercel / proxies).
 * Solo server components / server actions.
 */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    if (fwd) {
      const first = fwd.split(',')[0]?.trim();
      if (first) return first;
    }
    return h.get('x-real-ip')?.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}
