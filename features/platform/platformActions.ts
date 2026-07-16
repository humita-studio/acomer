'use server';

import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/shared/db';
import { perfilesEmpleados, restaurantes } from '@/shared/db/schema';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { isPlanId, type PlanId } from '@/features/billing/plans';
import { getPlatformSession } from './session';
import type {
  BillingStatus,
  PlatformListFilters,
  PlatformLocalDetalle,
  PlatformLocalListItem,
  PlatformStats,
} from './types';

const BILLING_STATUSES: BillingStatus[] = [
  'trial',
  'active',
  'past_due',
  'cancelled',
  'exempt',
];

function isBillingStatus(v: string): v is BillingStatus {
  return (BILLING_STATUSES as string[]).includes(v);
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function mapLocal(row: {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  plan: string;
  billingStatus: string;
  trialEndsAt: Date | null;
  periodEndsAt: Date | null;
  createdAt: Date;
}): PlatformLocalListItem {
  return {
    id: row.id,
    nombre: row.nombre,
    slug: row.slug,
    activo: row.activo,
    plan: (isPlanId(row.plan) ? row.plan : 'pro') as PlanId,
    billingStatus: (isBillingStatus(row.billingStatus)
      ? row.billingStatus
      : 'trial') as BillingStatus,
    trialEndsAt: toIso(row.trialEndsAt),
    periodEndsAt: toIso(row.periodEndsAt),
    createdAt: row.createdAt.toISOString(),
  };
}

async function requirePlatform() {
  const session = await getPlatformSession();
  if (!session) {
    return null;
  }
  return session;
}

function buildFilters(filters: PlatformListFilters = {}): SQL | undefined {
  const parts: SQL[] = [isNull(restaurantes.deletedAt)];

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    parts.push(
      or(ilike(restaurantes.nombre, pattern), ilike(restaurantes.slug, pattern))!,
    );
  }

  if (filters.billingStatus && filters.billingStatus !== 'all') {
    parts.push(eq(restaurantes.billingStatus, filters.billingStatus));
  }

  if (filters.plan && filters.plan !== 'all') {
    parts.push(eq(restaurantes.plan, filters.plan));
  }

  if (filters.activo === 'true') {
    parts.push(eq(restaurantes.activo, true));
  } else if (filters.activo === 'false') {
    parts.push(eq(restaurantes.activo, false));
  }

  return parts.length === 1 ? parts[0] : and(...parts);
}

export async function getPlatformStatsAction(): Promise<PlatformStats | null> {
  const session = await requirePlatform();
  if (!session) return null;

  try {
    const [row] = await db
      .select({
        total: count(),
        activos: sql<number>`count(*) filter (where ${restaurantes.activo} = true)::int`,
        trial: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'trial')::int`,
        exempt: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'exempt')::int`,
        pastDue: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'past_due')::int`,
        inactive: sql<number>`count(*) filter (where ${restaurantes.activo} = false)::int`,
      })
      .from(restaurantes)
      .where(isNull(restaurantes.deletedAt));

    return {
      total: Number(row?.total ?? 0),
      activos: Number(row?.activos ?? 0),
      trial: Number(row?.trial ?? 0),
      exempt: Number(row?.exempt ?? 0),
      pastDue: Number(row?.pastDue ?? 0),
      inactive: Number(row?.inactive ?? 0),
    };
  } catch (error) {
    console.error('[getPlatformStatsAction]', error);
    return null;
  }
}

export async function listLocalesAction(
  filters: PlatformListFilters = {},
): Promise<{ success: true; locales: PlatformLocalListItem[] } | { success: false; message: string }> {
  const session = await requirePlatform();
  if (!session) {
    return { success: false, message: 'Sin permiso de plataforma' };
  }

  try {
    const where = buildFilters(filters);
    const rows = await db
      .select({
        id: restaurantes.id,
        nombre: restaurantes.nombre,
        slug: restaurantes.slug,
        activo: restaurantes.activo,
        plan: restaurantes.plan,
        billingStatus: restaurantes.billingStatus,
        trialEndsAt: restaurantes.trialEndsAt,
        periodEndsAt: restaurantes.periodEndsAt,
        createdAt: restaurantes.createdAt,
      })
      .from(restaurantes)
      .where(where)
      .orderBy(desc(restaurantes.createdAt))
      .limit(200);

    return { success: true, locales: rows.map(mapLocal) };
  } catch (error) {
    console.error('[listLocalesAction]', { actor: session.user.email, error });
    return { success: false, message: 'No se pudieron listar los locales' };
  }
}

export async function getLocalDetalleAction(
  restauranteId: string,
): Promise<
  | { success: true; local: PlatformLocalDetalle }
  | { success: false; message: string }
> {
  const session = await requirePlatform();
  if (!session) {
    return { success: false, message: 'Sin permiso de plataforma' };
  }

  if (!restauranteId?.trim()) {
    return { success: false, message: 'ID inválido' };
  }

  try {
    const [row] = await db
      .select({
        id: restaurantes.id,
        nombre: restaurantes.nombre,
        slug: restaurantes.slug,
        activo: restaurantes.activo,
        plan: restaurantes.plan,
        billingStatus: restaurantes.billingStatus,
        trialEndsAt: restaurantes.trialEndsAt,
        periodEndsAt: restaurantes.periodEndsAt,
        createdAt: restaurantes.createdAt,
      })
      .from(restaurantes)
      .where(and(eq(restaurantes.id, restauranteId), isNull(restaurantes.deletedAt)))
      .limit(1);

    if (!row) {
      return { success: false, message: 'Local no encontrado' };
    }

    const [ownerPerfil] = await db
      .select({
        perfilId: perfilesEmpleados.id,
        userId: perfilesEmpleados.userId,
        activo: perfilesEmpleados.activo,
      })
      .from(perfilesEmpleados)
      .where(
        and(
          eq(perfilesEmpleados.restauranteId, restauranteId),
          eq(perfilesEmpleados.rol, 'owner'),
        ),
      )
      .limit(1);

    let ownerEmail: string | null = null;
    if (ownerPerfil) {
      try {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.auth.admin.getUserById(ownerPerfil.userId);
        if (!error && data.user?.email) {
          ownerEmail = data.user.email;
        }
      } catch (e) {
        console.error('[getLocalDetalleAction] owner email', e);
      }
    }

    const local: PlatformLocalDetalle = {
      ...mapLocal(row),
      owner: ownerPerfil
        ? {
            perfilId: ownerPerfil.perfilId,
            userId: ownerPerfil.userId,
            email: ownerEmail,
            activo: ownerPerfil.activo,
          }
        : null,
    };

    return { success: true, local };
  } catch (error) {
    console.error('[getLocalDetalleAction]', { actor: session.user.email, error });
    return { success: false, message: 'No se pudo cargar el local' };
  }
}

type ActionResult = { success: boolean; message: string };

function logPlatformMutation(
  action: string,
  actor: string,
  restauranteId: string,
  extra?: Record<string, unknown>,
) {
  console.info('[platform]', { action, actor, restauranteId, ...extra });
}

export async function setLocalExemptAction(restauranteId: string): Promise<ActionResult> {
  return updateBillingStatusAction(restauranteId, 'exempt');
}

export async function updateBillingStatusAction(
  restauranteId: string,
  status: BillingStatus,
): Promise<ActionResult> {
  const session = await requirePlatform();
  if (!session) return { success: false, message: 'Sin permiso de plataforma' };
  if (!isBillingStatus(status)) {
    return { success: false, message: 'Estado de billing inválido' };
  }

  try {
    const updated = await db
      .update(restaurantes)
      .set({ billingStatus: status })
      .where(and(eq(restaurantes.id, restauranteId), isNull(restaurantes.deletedAt)))
      .returning({ id: restaurantes.id });

    if (!updated[0]) return { success: false, message: 'Local no encontrado' };

    logPlatformMutation('updateBillingStatus', session.user.email, restauranteId, {
      status,
    });
    revalidatePath('/platform');
    revalidatePath(`/platform/locales/${restauranteId}`);
    return { success: true, message: `Billing actualizado a ${status}` };
  } catch (error) {
    console.error('[updateBillingStatusAction]', error);
    return { success: false, message: 'No se pudo actualizar el billing' };
  }
}

export async function updatePlanAction(
  restauranteId: string,
  plan: PlanId,
): Promise<ActionResult> {
  const session = await requirePlatform();
  if (!session) return { success: false, message: 'Sin permiso de plataforma' };
  if (!isPlanId(plan)) return { success: false, message: 'Plan inválido' };

  try {
    const updated = await db
      .update(restaurantes)
      .set({ plan })
      .where(and(eq(restaurantes.id, restauranteId), isNull(restaurantes.deletedAt)))
      .returning({ id: restaurantes.id });

    if (!updated[0]) return { success: false, message: 'Local no encontrado' };

    logPlatformMutation('updatePlan', session.user.email, restauranteId, { plan });
    revalidatePath('/platform');
    revalidatePath(`/platform/locales/${restauranteId}`);
    return { success: true, message: `Plan actualizado a ${plan}` };
  } catch (error) {
    console.error('[updatePlanAction]', error);
    return { success: false, message: 'No se pudo actualizar el plan' };
  }
}

export async function extendTrialAction(
  restauranteId: string,
  days = 90,
): Promise<ActionResult> {
  const session = await requirePlatform();
  if (!session) return { success: false, message: 'Sin permiso de plataforma' };

  const n = Number(days);
  if (!Number.isFinite(n) || n < 1 || n > 365) {
    return { success: false, message: 'Días inválidos (1–365)' };
  }

  try {
    const trialEndsAt = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    const updated = await db
      .update(restaurantes)
      .set({
        trialEndsAt,
        billingStatus: 'trial',
      })
      .where(and(eq(restaurantes.id, restauranteId), isNull(restaurantes.deletedAt)))
      .returning({ id: restaurantes.id });

    if (!updated[0]) return { success: false, message: 'Local no encontrado' };

    logPlatformMutation('extendTrial', session.user.email, restauranteId, {
      days: n,
      trialEndsAt: trialEndsAt.toISOString(),
    });
    revalidatePath('/platform');
    revalidatePath(`/platform/locales/${restauranteId}`);
    return {
      success: true,
      message: `Trial extendido ${n} días (hasta ${trialEndsAt.toLocaleDateString('es-AR')})`,
    };
  } catch (error) {
    console.error('[extendTrialAction]', error);
    return { success: false, message: 'No se pudo extender el trial' };
  }
}

export async function setLocalActivoAction(
  restauranteId: string,
  activo: boolean,
): Promise<ActionResult> {
  const session = await requirePlatform();
  if (!session) return { success: false, message: 'Sin permiso de plataforma' };

  try {
    const updated = await db
      .update(restaurantes)
      .set({ activo })
      .where(and(eq(restaurantes.id, restauranteId), isNull(restaurantes.deletedAt)))
      .returning({ id: restaurantes.id });

    if (!updated[0]) return { success: false, message: 'Local no encontrado' };

    logPlatformMutation('setActivo', session.user.email, restauranteId, { activo });
    revalidatePath('/platform');
    revalidatePath(`/platform/locales/${restauranteId}`);
    return {
      success: true,
      message: activo ? 'Local activado' : 'Local desactivado',
    };
  } catch (error) {
    console.error('[setLocalActivoAction]', error);
    return { success: false, message: 'No se pudo cambiar el estado del local' };
  }
}

/** URL pública del tenant (carta / landing del local). */
export async function getTenantPublicBaseUrl(slug: string): Promise<string> {
  const root =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    (process.env.NODE_ENV === 'production' ? 'acomer.com.ar' : 'localhost:3000');
  const protocol = root.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${slug}.${root}`;
}
