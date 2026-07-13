import {
  planDef,
  GRACE_DAYS,
  BILLING_COBRO_HABILITADO,
  type PlanId,
} from './plans';

export type BillingStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'exempt';

export type BillingSnapshot = {
  plan: PlanId;
  planNombre: string;
  billingStatus: BillingStatus;
  trialEndsAt: Date | null;
  periodEndsAt: Date | null;
  /** true si puede usar el panel (trial/active/exempt o gracia). */
  accessOk: boolean;
  /** true si hay que mostrar banner de cobro. */
  showPayBanner: boolean;
  /** Días restantes de trial o período (puede ser negativo). */
  daysLeft: number | null;
  maxMesas: number | null;
  precioMensual: number | null;
  label: string;
  /** true mientras el producto es free (sin cobro SaaS). */
  freeMode: boolean;
};

function asPlan(v: string | null | undefined): PlanId {
  if (v === 'basico' || v === 'pro' || v === 'a_medida') return v;
  return 'pro';
}

function asStatus(v: string | null | undefined): BillingStatus {
  if (
    v === 'trial' ||
    v === 'active' ||
    v === 'past_due' ||
    v === 'cancelled' ||
    v === 'exempt'
  ) {
    return v;
  }
  return 'trial';
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Evalúa acceso al panel a partir de los campos de billing del restaurante.
 * Pura: sin DB ni env.
 *
 * Con `BILLING_COBRO_HABILITADO === false`: siempre acceso ok, sin banner de
 * pago y sin límite de mesas (producto free hasta poder cobrar).
 */
export function evaluateBilling(input: {
  plan?: string | null;
  billingStatus?: string | null;
  trialEndsAt?: Date | string | null;
  periodEndsAt?: Date | string | null;
  now?: Date;
}): BillingSnapshot {
  const now = input.now ?? new Date();
  const plan = asPlan(input.plan);
  const def = planDef(plan);
  let status = asStatus(input.billingStatus);
  const trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
  const periodEndsAt = input.periodEndsAt ? new Date(input.periodEndsAt) : null;

  // Free hasta poder cobrar: no hard-gate, no banner, no límite de mesas.
  if (!BILLING_COBRO_HABILITADO) {
    return {
      plan,
      planNombre: def.nombre,
      billingStatus: status === 'exempt' ? 'exempt' : status,
      trialEndsAt,
      periodEndsAt,
      accessOk: true,
      showPayBanner: false,
      daysLeft: null,
      maxMesas: null,
      precioMensual: def.precioMensual,
      label: status === 'exempt' ? 'Exento (piloto)' : 'Gratis · hasta habilitar cobro',
      freeMode: true,
    };
  }

  let accessOk = true;
  let showPayBanner = false;
  let daysLeft: number | null = null;
  let label = 'Activo';

  if (status === 'exempt') {
    return {
      plan,
      planNombre: def.nombre,
      billingStatus: status,
      trialEndsAt,
      periodEndsAt,
      accessOk: true,
      showPayBanner: false,
      daysLeft: null,
      maxMesas: def.maxMesas,
      precioMensual: def.precioMensual,
      label: 'Exento (piloto)',
      freeMode: false,
    };
  }

  if (status === 'trial' && trialEndsAt) {
    daysLeft = daysBetween(now, trialEndsAt);
    if (daysLeft > 3) {
      label = `Prueba · ${daysLeft} días`;
      showPayBanner = false;
      accessOk = true;
    } else if (daysLeft > 0) {
      label = `Prueba · ${daysLeft} día${daysLeft === 1 ? '' : 's'}`;
      showPayBanner = true;
      accessOk = true;
    } else if (daysLeft > -GRACE_DAYS) {
      label = 'Prueba vencida · gracia';
      showPayBanner = true;
      accessOk = true;
      status = 'past_due';
    } else {
      label = 'Prueba vencida';
      showPayBanner = true;
      accessOk = false;
      status = 'past_due';
    }
  } else if (status === 'active' && periodEndsAt) {
    daysLeft = daysBetween(now, periodEndsAt);
    if (daysLeft > 7) {
      label = `Activo · vence en ${daysLeft} días`;
      accessOk = true;
      showPayBanner = false;
    } else if (daysLeft > 0) {
      label = `Activo · vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`;
      accessOk = true;
      showPayBanner = true;
    } else if (daysLeft > -GRACE_DAYS) {
      label = 'Período vencido · gracia';
      accessOk = true;
      showPayBanner = true;
      status = 'past_due';
    } else {
      label = 'Suscripción vencida';
      accessOk = false;
      showPayBanner = true;
      status = 'past_due';
    }
  } else if (status === 'active') {
    label = 'Activo';
    accessOk = true;
  } else if (status === 'past_due' || status === 'cancelled') {
    // Si hay periodEndsAt futuro (reactivación parcial), respetarlo.
    if (periodEndsAt && periodEndsAt.getTime() > now.getTime()) {
      daysLeft = daysBetween(now, periodEndsAt);
      accessOk = true;
      showPayBanner = true;
      label = status === 'cancelled' ? 'Cancelado · acceso hasta fin de período' : 'Pago pendiente';
    } else if (periodEndsAt && daysBetween(now, periodEndsAt) > -GRACE_DAYS) {
      accessOk = true;
      showPayBanner = true;
      label = 'Gracia · reactivá el plan';
    } else {
      accessOk = false;
      showPayBanner = true;
      label = status === 'cancelled' ? 'Cancelado' : 'Pago pendiente';
    }
  }

  return {
    plan,
    planNombre: def.nombre,
    billingStatus: status,
    trialEndsAt,
    periodEndsAt,
    accessOk,
    showPayBanner,
    daysLeft,
    maxMesas: def.maxMesas,
    precioMensual: def.precioMensual,
    label,
    freeMode: false,
  };
}
