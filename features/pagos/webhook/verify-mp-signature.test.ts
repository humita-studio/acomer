import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from './verify-mp-signature';

describe('verifyMercadoPagoSignature', () => {
  it('skips when no secret', () => {
    const r = verifyMercadoPagoSignature({
      xSignature: null,
      xRequestId: null,
      dataId: '123',
      secret: null,
    });
    expect(r).toEqual({ ok: true, skipped: true });
  });

  it('rejects missing signature when secret is set', () => {
    const r = verifyMercadoPagoSignature({
      xSignature: null,
      xRequestId: 'req-1',
      dataId: '123',
      secret: 's3cret',
    });
    expect(r.ok).toBe(false);
  });

  it('accepts valid HMAC', () => {
    const secret = 'test-secret';
    const dataId = 'ABC123';
    const requestId = 'req-xyz';
    const ts = '1704908010';
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

    const r = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(r).toEqual({ ok: true });
  });

  it('rejects tampered signature', () => {
    const r = verifyMercadoPagoSignature({
      xSignature: 'ts=1704908010,v1=deadbeef',
      xRequestId: 'req-1',
      dataId: '123',
      secret: 's3cret',
    });
    expect(r.ok).toBe(false);
  });
});
