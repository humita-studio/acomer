import { describe, expect, it } from 'vitest';
import { evaluateBilling } from './access';

describe('evaluateBilling', () => {
  const now = new Date('2026-07-13T12:00:00Z');

  it('trial con días de sobra: acceso ok, sin banner', () => {
    const r = evaluateBilling({
      plan: 'pro',
      billingStatus: 'trial',
      trialEndsAt: new Date('2026-07-25T12:00:00Z'),
      now,
    });
    expect(r.accessOk).toBe(true);
    expect(r.showPayBanner).toBe(false);
    expect(r.daysLeft).toBe(12);
  });

  it('trial por vencer: banner', () => {
    const r = evaluateBilling({
      plan: 'pro',
      billingStatus: 'trial',
      trialEndsAt: new Date('2026-07-15T12:00:00Z'),
      now,
    });
    expect(r.accessOk).toBe(true);
    expect(r.showPayBanner).toBe(true);
  });

  it('trial vencido + gracia agotada: sin acceso', () => {
    const r = evaluateBilling({
      plan: 'basico',
      billingStatus: 'trial',
      trialEndsAt: new Date('2026-07-01T12:00:00Z'),
      now,
    });
    expect(r.accessOk).toBe(false);
    expect(r.showPayBanner).toBe(true);
  });

  it('exempt siempre ok', () => {
    const r = evaluateBilling({
      plan: 'pro',
      billingStatus: 'exempt',
      now,
    });
    expect(r.accessOk).toBe(true);
    expect(r.showPayBanner).toBe(false);
  });

  it('active con período futuro', () => {
    const r = evaluateBilling({
      plan: 'pro',
      billingStatus: 'active',
      periodEndsAt: new Date('2026-08-13T12:00:00Z'),
      now,
    });
    expect(r.accessOk).toBe(true);
    expect(r.daysLeft).toBe(31);
  });
});
