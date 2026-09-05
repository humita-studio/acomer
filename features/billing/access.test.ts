import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('evaluateBilling con cobro prendido (NEXT_PUBLIC_BILLING_COBRO_HABILITADO=1)', () => {
  const now = new Date('2026-07-13T12:00:00Z');

  async function cargar() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BILLING_COBRO_HABILITADO', '1');
    const mod = await import('./access');
    return mod.evaluateBilling;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('prueba vigente: acceso sin banner hasta los últimos 3 días', async () => {
    const evaluar = await cargar();
    const r = evaluar({ plan: 'pro', billingStatus: 'trial', trialEndsAt: new Date('2026-08-01T12:00:00Z'), now });
    expect(r.freeMode).toBe(false);
    expect(r.accessOk).toBe(true);
    expect(r.showPayBanner).toBe(false);
  });

  it('prueba vencida hace más de 3 días: bloquea', async () => {
    const evaluar = await cargar();
    const r = evaluar({ plan: 'pro', billingStatus: 'trial', trialEndsAt: new Date('2026-07-01T12:00:00Z'), now });
    expect(r.accessOk).toBe(false);
    expect(r.showPayBanner).toBe(true);
    expect(r.billingStatus).toBe('past_due');
  });

  it('exento: nunca bloquea ni muestra banner', async () => {
    const evaluar = await cargar();
    const r = evaluar({ plan: 'a_medida', billingStatus: 'exempt', now });
    expect(r.accessOk).toBe(true);
    expect(r.showPayBanner).toBe(false);
  });

  it('activo con período vigente: acceso; vencido con gracia: acceso con banner', async () => {
    const evaluar = await cargar();
    const ok = evaluar({ plan: 'basico', billingStatus: 'active', periodEndsAt: new Date('2026-08-01T12:00:00Z'), now });
    expect(ok.accessOk).toBe(true);
    const gracia = evaluar({ plan: 'basico', billingStatus: 'active', periodEndsAt: new Date('2026-07-12T12:00:00Z'), now });
    expect(gracia.accessOk).toBe(true);
    expect(gracia.showPayBanner).toBe(true);
  });
});
