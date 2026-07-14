import { describe, expect, it } from 'vitest';
import { evaluateBilling } from './access';
import { BILLING_COBRO_HABILITADO } from './plans';

describe('evaluateBilling', () => {
  const now = new Date('2026-07-13T12:00:00Z');

  // Mientras no cobremos, el producto es free: siempre acceso y sin límites.
  if (!BILLING_COBRO_HABILITADO) {
    it('free mode: trial vencido sigue con acceso y sin banner', () => {
      const r = evaluateBilling({
        plan: 'basico',
        billingStatus: 'trial',
        trialEndsAt: new Date('2026-07-01T12:00:00Z'),
        now,
      });
      expect(r.accessOk).toBe(true);
      expect(r.showPayBanner).toBe(false);
      expect(r.maxMesas).toBeNull();
      expect(r.freeMode).toBe(true);
      expect(r.label).toMatch(/gratis/i);
    });

    it('free mode: exempt ok', () => {
      const r = evaluateBilling({
        plan: 'pro',
        billingStatus: 'exempt',
        now,
      });
      expect(r.accessOk).toBe(true);
      expect(r.showPayBanner).toBe(false);
      expect(r.freeMode).toBe(true);
    });

    it('free mode: past_due no corta acceso ni mesas', () => {
      const r = evaluateBilling({
        plan: 'pro',
        billingStatus: 'past_due',
        periodEndsAt: new Date('2026-06-01T12:00:00Z'),
        now,
      });
      expect(r.accessOk).toBe(true);
      expect(r.showPayBanner).toBe(false);
      expect(r.maxMesas).toBeNull();
    });

    return;
  }

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
    expect(r.freeMode).toBe(false);
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
