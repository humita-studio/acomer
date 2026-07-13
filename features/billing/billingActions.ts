'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/shared/db';
import { pagosSuscripcion, restaurantes } from '@/shared/db/schema';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { withTenant } from '@/shared/db/secure-wrapper';
import { evaluateBilling, type BillingSnapshot } from './access';
import { PERIOD_DAYS, isPlanId, planDef, type PlanId } from './plans';
import { createBillingPreference, getBillingAccessToken } from './mpBilling';

export type BillingView = BillingSnapshot & {
  billingConfigured: boolean;
  historial: {
    id: string;
    plan: string;
    monto: number;
    estado: string;
    createdAt: string;
    periodEnd: string | null;
  }[];
};

export async function getBillingViewAction(): Promise<BillingView | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const [rest] = await db
    .select({
      plan: restaurantes.plan,
      billingStatus: restaurantes.billingStatus,
      trialEndsAt: restaurantes.trialEndsAt,
      periodEndsAt: restaurantes.periodEndsAt,
    })
    .from(restaurantes)
    .where(eq(restaurantes.id, session.restauranteId))
    .limit(1);

  if (!rest) return null;

  const snap = evaluateBilling(rest);

  const historial = await withTenant(claimsFromSession(session), (tx) =>
    tx
      .select({
        id: pagosSuscripcion.id,
        plan: pagosSuscripcion.plan,
        monto: pagosSuscripcion.monto,
        estado: pagosSuscripcion.estado,
        createdAt: pagosSuscripcion.createdAt,
        periodEnd: pagosSuscripcion.periodEnd,
      })
      .from(pagosSuscripcion)
      .where(eq(pagosSuscripcion.restauranteId, session.restauranteId))
      .orderBy(desc(pagosSuscripcion.createdAt))
      .limit(12),
  );

  return {
    ...snap,
    billingConfigured: !!getBillingAccessToken(),
    historial: historial.map((h) => ({
      id: h.id,
      plan: h.plan,
      monto: Number(h.monto),
      estado: h.estado,
      createdAt: h.createdAt.toISOString(),
      periodEnd: h.periodEnd?.toISOString() ?? null,
    })),
  };
}

/** Solo lectura para el layout (gate + banner). */
export async function getBillingSnapshotAction(): Promise<BillingSnapshot | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const [rest] = await db
    .select({
      plan: restaurantes.plan,
      billingStatus: restaurantes.billingStatus,
      trialEndsAt: restaurantes.trialEndsAt,
      periodEndsAt: restaurantes.periodEndsAt,
    })
    .from(restaurantes)
    .where(eq(restaurantes.id, session.restauranteId))
    .limit(1);

  if (!rest) return null;
  return evaluateBilling(rest);
}

/**
 * Cambia el plan elegido (basico/pro). No cobra: el cobro es explícito con checkout.
 * a_medida no se elige online.
 */
export async function elegirPlanAction(plan: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
    return { success: false, message: 'No autorizado' };
  }
  if (!isPlanId(plan) || plan === 'a_medida') {
    return { success: false, message: 'Plan inválido. Para A medida, contactanos.' };
  }

  await db
    .update(restaurantes)
    .set({ plan })
    .where(eq(restaurantes.id, session.restauranteId));

  revalidatePath('/admin/billing');
  return { success: true, message: `Plan ${planDef(plan).nombre} seleccionado` };
}

/**
 * Crea un cobro pendiente + preferencia MP y devuelve el init_point.
 * Extiende el acceso 30 días cuando el webhook marca approved.
 */
export async function iniciarPagoSuscripcionAction(planId?: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
    return { success: false as const, message: 'Solo el dueño o admin pueden pagar el plan.' };
  }

  const token = getBillingAccessToken();
  if (!token) {
    return {
      success: false as const,
      message:
        'El cobro online todavía no está configurado (falta MP_BILLING_ACCESS_TOKEN). Contactá a acomer.',
    };
  }

  const [rest] = await db
    .select({ plan: restaurantes.plan, nombre: restaurantes.nombre })
    .from(restaurantes)
    .where(eq(restaurantes.id, session.restauranteId))
    .limit(1);

  const plan: PlanId =
    planId && isPlanId(planId) && planId !== 'a_medida'
      ? planId
      : isPlanId(rest?.plan ?? '') && rest!.plan !== 'a_medida'
        ? (rest!.plan as PlanId)
        : 'pro';

  const def = planDef(plan);
  if (def.precioMensual == null || def.precioMensual <= 0) {
    return { success: false as const, message: 'Ese plan se coordina con ventas, no se paga online.' };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const [pago] = await db
    .insert(pagosSuscripcion)
    .values({
      restauranteId: session.restauranteId,
      plan,
      monto: def.precioMensual.toFixed(2),
      estado: 'pending',
      metadata: {
        restaurante: rest?.nombre ?? '',
        email: session.user.email,
      },
    })
    .returning({ id: pagosSuscripcion.id });

  const pref = await createBillingPreference({
    accessToken: token,
    pagoId: pago.id,
    planNombre: def.nombre,
    monto: def.precioMensual,
    payerEmail: session.user.email || undefined,
    successUrl: `${appUrl}/admin/billing?pago=exito&id=${pago.id}`,
    failureUrl: `${appUrl}/admin/billing?pago=error&id=${pago.id}`,
    pendingUrl: `${appUrl}/admin/billing?pago=pendiente&id=${pago.id}`,
    notificationUrl: `${appUrl}/api/webhooks/billing/mp`,
  });

  if (!pref.ok) {
    await db
      .update(pagosSuscripcion)
      .set({ estado: 'cancelled', updatedAt: new Date() })
      .where(eq(pagosSuscripcion.id, pago.id));
    return { success: false as const, message: pref.error };
  }

  await db
    .update(pagosSuscripcion)
    .set({ mpPreferenceId: pref.preferenceId, updatedAt: new Date() })
    .where(eq(pagosSuscripcion.id, pago.id));

  // Guardar plan elegido
  await db
    .update(restaurantes)
    .set({ plan })
    .where(eq(restaurantes.id, session.restauranteId));

  return { success: true as const, paymentUrl: pref.initPoint, pagoId: pago.id };
}

/** Aplica un pago aprobado (webhook o verificación manual). */
export async function settleBillingPayment(opts: {
  pagoId: string;
  mpPaymentId: string;
  amount: number;
  mpStatus: string;
}): Promise<{ ok: boolean; message?: string }> {
  const [pago] = await db
    .select()
    .from(pagosSuscripcion)
    .where(eq(pagosSuscripcion.id, opts.pagoId))
    .limit(1);

  if (!pago) return { ok: false, message: 'Pago no encontrado' };

  if (pago.estado === 'approved') {
    return { ok: true, message: 'already' };
  }

  const expected = Number(pago.monto);
  // Tolerancia 1 ARS por redondeos
  if (opts.amount + 0.01 < expected) {
    return { ok: false, message: 'Monto insuficiente' };
  }

  const approved =
    opts.mpStatus === 'approved' || opts.mpStatus === 'authorized';

  if (!approved) {
    if (opts.mpStatus === 'rejected' || opts.mpStatus === 'cancelled') {
      await db
        .update(pagosSuscripcion)
        .set({
          estado: opts.mpStatus === 'cancelled' ? 'cancelled' : 'rejected',
          mpPaymentId: opts.mpPaymentId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(pagosSuscripcion.id, pago.id), eq(pagosSuscripcion.estado, 'pending')),
        );
    }
    return { ok: true, message: 'not_approved' };
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // Extender desde el fin actual si aún está vigente.
  const [rest] = await db
    .select({ periodEndsAt: restaurantes.periodEndsAt })
    .from(restaurantes)
    .where(eq(restaurantes.id, pago.restauranteId))
    .limit(1);

  let end = periodEnd;
  if (rest?.periodEndsAt && rest.periodEndsAt.getTime() > Date.now()) {
    end = new Date(rest.periodEndsAt.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
  }

  await db
    .update(pagosSuscripcion)
    .set({
      estado: 'approved',
      mpPaymentId: opts.mpPaymentId,
      periodStart,
      periodEnd: end,
      updatedAt: new Date(),
    })
    .where(and(eq(pagosSuscripcion.id, pago.id), eq(pagosSuscripcion.estado, 'pending')));

  await db
    .update(restaurantes)
    .set({
      plan: pago.plan,
      billingStatus: 'active',
      periodEndsAt: end,
    })
    .where(eq(restaurantes.id, pago.restauranteId));

  return { ok: true, message: 'activated' };
}


