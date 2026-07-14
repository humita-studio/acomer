import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Valida la firma x-signature de webhooks de Mercado Pago.
 *
 * Manifest: `id:{dataId};request-id:{xRequestId};ts:{ts};`
 * HMAC-SHA256 con el secret de la aplicación (MP_WEBHOOK_SECRET).
 *
 * Si no hay secret configurado (dev local), se omite la validación y se
 * devuelve `{ ok: true, skipped: true }`. En producción conviene setearlo.
 */
export type SignatureResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: string };

export function verifyMercadoPagoSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret?: string | null;
}): SignatureResult {
  const secret = opts.secret ?? process.env.MP_WEBHOOK_SECRET ?? null;

  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!opts.xSignature) {
    return { ok: false, reason: 'Missing x-signature header' };
  }

  const parts = Object.fromEntries(
    opts.xSignature.split(',').map((part) => {
      const [k, ...rest] = part.trim().split('=');
      return [k, rest.join('=')];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    return { ok: false, reason: 'Invalid x-signature format' };
  }

  const requestId = opts.xRequestId ?? '';
  // MP documenta el data.id en minúsculas para el manifest.
  const dataId = String(opts.dataId).toLowerCase();
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(v1, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'Signature mismatch' };
    }
  } catch {
    return { ok: false, reason: 'Signature comparison failed' };
  }

  return { ok: true };
}
