'use server';

import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/shared/db';
import {
  pagosSuscripcion,
  pedidos,
  perfilesEmpleados,
  restaurantes,
  transaccionesPago,
} from '@/shared/db/schema';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { PLANES_SAAS, isPlanId, type PlanId } from '@/features/billing/plans';
import { instanteEnZona, partesEnZona } from '@/shared/lib/zonaHoraria';
import { getPlatformSession } from './session';
import type {
  BillingStatus,
  PlatformAtencion,
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Límites de "hoy", "este mes" y "mes anterior" en la zona del local (no UTC). */
function limitesDeCalendario(ahora: Date) {
  const { ymd } = partesEnZona(ahora);
  const [y, m] = ymd.split('-').map(Number);
  const inicioHoy = instanteEnZona(ymd, '00:00');
  const inicioMes = instanteEnZona(`${y}-${pad2(m)}-01`, '00:00');
  const anterior = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const inicioMesAnterior = instanteEnZona(`${anterior.y}-${pad2(anterior.m)}-01`, '00:00');
  return { inicioHoy, inicioMes, inicioMesAnterior };
}

const DIA_MS = 86_400_000;
const TZ_SQL = "'America/Argentina/Buenos_Aires'";

/** 'YYYY-MM' de los últimos `n` meses (incluido el actual), en la zona del local. */
function ultimosMeses(ahora: Date, n: number): string[] {
  const { ymd } = partesEnZona(ahora);
  let [y, m] = ymd.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${pad2(m)}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** 'YYYY-MM-DD' de los últimos `n` días (incluido hoy), en la zona del local. */
function ultimosDias(ahora: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(partesEnZona(new Date(ahora.getTime() - i * DIA_MS)).ymd);
  }
  return out;
}
// Las fechas viajan al SQL como ISO + cast: el driver sin prepared statements no serializa Date.

export async function getPlatformStatsAction(): Promise<PlatformStats | null> {
  const session = await requirePlatform();
  if (!session) return null;

  try {
    const ahora = new Date();
    const { inicioHoy, inicioMes, inicioMesAnterior } = limitesDeCalendario(ahora);
    const hace7 = new Date(ahora.getTime() - 7 * DIA_MS);
    const hace14 = new Date(ahora.getTime() - 14 * DIA_MS);
    const hace30 = new Date(ahora.getTime() - 30 * DIA_MS);
    const en7 = new Date(ahora.getTime() + 7 * DIA_MS);
    const meses = ultimosMeses(ahora, 6);
    const dias = ultimosDias(ahora, 30);
    const inicioSerieMeses = instanteEnZona(`${meses[0]}-01`, '00:00');
    const inicioSerieDias = instanteEnZona(dias[0], '00:00');

    const [[conteos], [ingresos], activosPagando, [uso], pagos, atencionRows, ingresosMesRows, pedidosDiaRows, volumenDiaRows, altasMesRows, topRows] = await Promise.all([
      db
        .select({
          total: count(),
          activos: sql<number>`count(*) filter (where ${restaurantes.activo} = true)::int`,
          trial: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'trial')::int`,
          exempt: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'exempt')::int`,
          pastDue: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'past_due')::int`,
          inactive: sql<number>`count(*) filter (where ${restaurantes.activo} = false)::int`,
          activosPago: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'active')::int`,
          nuevosMes: sql<number>`count(*) filter (where ${restaurantes.createdAt} >= ${inicioMes.toISOString()}::timestamptz)::int`,
          trial7: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'trial' and ${restaurantes.trialEndsAt} between ${ahora.toISOString()}::timestamptz and ${en7.toISOString()}::timestamptz)::int`,
          periodo7: sql<number>`count(*) filter (where ${restaurantes.billingStatus} = 'active' and ${restaurantes.periodEndsAt} between ${ahora.toISOString()}::timestamptz and ${en7.toISOString()}::timestamptz)::int`,
        })
        .from(restaurantes)
        .where(isNull(restaurantes.deletedAt)),
      db
        .select({
          mesActual: sql<string>`coalesce(sum(${pagosSuscripcion.monto}) filter (where ${pagosSuscripcion.estado} = 'approved' and ${pagosSuscripcion.createdAt} >= ${inicioMes.toISOString()}::timestamptz), 0)`,
          mesAnterior: sql<string>`coalesce(sum(${pagosSuscripcion.monto}) filter (where ${pagosSuscripcion.estado} = 'approved' and ${pagosSuscripcion.createdAt} >= ${inicioMesAnterior.toISOString()}::timestamptz and ${pagosSuscripcion.createdAt} < ${inicioMes.toISOString()}::timestamptz), 0)`,
          total: sql<string>`coalesce(sum(${pagosSuscripcion.monto}) filter (where ${pagosSuscripcion.estado} = 'approved'), 0)`,
          pagosMesActual: sql<number>`count(*) filter (where ${pagosSuscripcion.estado} = 'approved' and ${pagosSuscripcion.createdAt} >= ${inicioMes.toISOString()}::timestamptz)::int`,
        })
        .from(pagosSuscripcion),
      db
        .select({ plan: restaurantes.plan })
        .from(restaurantes)
        .where(and(isNull(restaurantes.deletedAt), eq(restaurantes.billingStatus, 'active'))),
      db
        .select({
          pedidos30d: sql<number>`(select count(*) from ${pedidos} where ${pedidos.createdAt} >= ${hace30.toISOString()}::timestamptz and ${pedidos.estado} <> 'Cancelado')::int`,
          pedidosHoy: sql<number>`(select count(*) from ${pedidos} where ${pedidos.createdAt} >= ${inicioHoy.toISOString()}::timestamptz and ${pedidos.estado} <> 'Cancelado')::int`,
          localesConActividad7d: sql<number>`(select count(distinct ${pedidos.restauranteId}) from ${pedidos} where ${pedidos.createdAt} >= ${hace7.toISOString()}::timestamptz)::int`,
          volumen30d: sql<string>`(select coalesce(sum(${transaccionesPago.monto}), 0) from ${transaccionesPago} where ${transaccionesPago.estado} = 'Aprobado' and ${transaccionesPago.createdAt} >= ${hace30.toISOString()}::timestamptz)`,
        })
        .from(sql`(select 1) as uno`),
      db
        .select({
          id: pagosSuscripcion.id,
          fecha: pagosSuscripcion.createdAt,
          localId: restaurantes.id,
          localNombre: restaurantes.nombre,
          localSlug: restaurantes.slug,
          plan: pagosSuscripcion.plan,
          monto: pagosSuscripcion.monto,
          estado: pagosSuscripcion.estado,
        })
        .from(pagosSuscripcion)
        .innerJoin(restaurantes, eq(restaurantes.id, pagosSuscripcion.restauranteId))
        .orderBy(desc(pagosSuscripcion.createdAt))
        .limit(8),
      db
        .select({
          id: restaurantes.id,
          nombre: restaurantes.nombre,
          slug: restaurantes.slug,
          billingStatus: restaurantes.billingStatus,
          trialEndsAt: restaurantes.trialEndsAt,
          periodEndsAt: restaurantes.periodEndsAt,
          createdAt: restaurantes.createdAt,
          // Con alias explícito: drizzle renderiza las columnas sin tabla dentro del
          // sql y `"restaurant_id" = "id"` comparaba el pedido consigo mismo.
          ultimoPedido: sql<string | null>`(select max(p.created_at) from ${pedidos} p where p.restaurant_id = ${restaurantes}.id)`,
        })
        .from(restaurantes)
        .where(and(isNull(restaurantes.deletedAt), eq(restaurantes.activo, true))),
      db.execute<{ mes: string; monto: string; pagos: number }>(sql`
        select to_char(${pagosSuscripcion.createdAt} at time zone ${sql.raw(TZ_SQL)}, 'YYYY-MM') as mes,
               coalesce(sum(${pagosSuscripcion.monto}), 0) as monto,
               count(*)::int as pagos
        from ${pagosSuscripcion}
        where ${pagosSuscripcion.estado} = 'approved' and ${pagosSuscripcion.createdAt} >= ${inicioSerieMeses.toISOString()}::timestamptz
        group by 1`),
      db.execute<{ dia: string; pedidos: number }>(sql`
        select to_char(${pedidos.createdAt} at time zone ${sql.raw(TZ_SQL)}, 'YYYY-MM-DD') as dia, count(*)::int as pedidos
        from ${pedidos}
        where ${pedidos.createdAt} >= ${inicioSerieDias.toISOString()}::timestamptz and ${pedidos.estado} <> 'Cancelado'
        group by 1`),
      db.execute<{ dia: string; volumen: string }>(sql`
        select to_char(${transaccionesPago.createdAt} at time zone ${sql.raw(TZ_SQL)}, 'YYYY-MM-DD') as dia,
               coalesce(sum(${transaccionesPago.monto}), 0) as volumen
        from ${transaccionesPago}
        where ${transaccionesPago.estado} = 'Aprobado' and ${transaccionesPago.createdAt} >= ${inicioSerieDias.toISOString()}::timestamptz
        group by 1`),
      db.execute<{ mes: string; altas: number }>(sql`
        select to_char(${restaurantes.createdAt} at time zone ${sql.raw(TZ_SQL)}, 'YYYY-MM') as mes, count(*)::int as altas
        from ${restaurantes}
        where ${restaurantes.deletedAt} is null and ${restaurantes.createdAt} >= ${inicioSerieMeses.toISOString()}::timestamptz
        group by 1`),
      db.execute<{ id: string; nombre: string; slug: string; volumen: string; pedidos: number }>(sql`
        select r.id, r.nombre, r.slug,
               (select coalesce(sum(t.monto), 0) from ${transaccionesPago} t
                 where t.restaurant_id = r.id and t.estado = 'Aprobado' and t.created_at >= ${hace30.toISOString()}::timestamptz) as volumen,
               (select count(*)::int from ${pedidos} p
                 where p.restaurant_id = r.id and p.estado <> 'Cancelado' and p.created_at >= ${hace30.toISOString()}::timestamptz) as pedidos
        from ${restaurantes} r
        where r.deleted_at is null
        order by volumen desc, pedidos desc
        limit 5`),
    ]);

    const mrr = activosPagando.reduce((acc, r) => {
      const plan = isPlanId(r.plan) ? r.plan : 'pro';
      return acc + (PLANES_SAAS[plan].precioMensual ?? 0);
    }, 0);

    const atencion: PlatformAtencion[] = [];
    for (const r of atencionRows) {
      const dias = (d: Date | null) => (d ? Math.ceil((new Date(d).getTime() - ahora.getTime()) / DIA_MS) : null);
      if (r.billingStatus === 'trial') {
        const d = dias(r.trialEndsAt);
        if (d !== null && d <= 7 && d >= 0) {
          atencion.push({ id: r.id, nombre: r.nombre, slug: r.slug, motivo: 'trial_por_vencer', detalle: d === 0 ? 'La prueba vence hoy' : `La prueba vence en ${d} día${d === 1 ? '' : 's'}` });
        } else if (d !== null && d < 0) {
          atencion.push({ id: r.id, nombre: r.nombre, slug: r.slug, motivo: 'trial_vencido', detalle: `Prueba vencida hace ${-d} día${-d === 1 ? '' : 's'}` });
        }
      } else if (r.billingStatus === 'active') {
        const d = dias(r.periodEndsAt);
        if (d !== null && d <= 7) {
          atencion.push({ id: r.id, nombre: r.nombre, slug: r.slug, motivo: 'periodo_por_vencer', detalle: d < 0 ? `Período vencido hace ${-d} día${-d === 1 ? '' : 's'}` : d === 0 ? 'El período vence hoy' : `El período vence en ${d} día${d === 1 ? '' : 's'}` });
        }
      } else if (r.billingStatus === 'past_due') {
        atencion.push({ id: r.id, nombre: r.nombre, slug: r.slug, motivo: 'vencido', detalle: 'Pago pendiente' });
      }
      const ultimo = r.ultimoPedido ? new Date(r.ultimoPedido) : null;
      const antiguo = new Date(r.createdAt).getTime() < hace14.getTime();
      if (antiguo && r.billingStatus !== 'exempt' && (!ultimo || ultimo.getTime() < hace14.getTime())) {
        atencion.push({
          id: r.id,
          nombre: r.nombre,
          slug: r.slug,
          motivo: 'sin_actividad',
          detalle: ultimo ? `Sin pedidos desde el ${partesEnZona(ultimo).ymd.split('-').reverse().join('/')}` : 'Nunca cargó un pedido',
        });
      }
    }

    const porMes = new Map(Array.from(ingresosMesRows, (r) => [r.mes, r]));
    const pedidosPorDiaMap = new Map(Array.from(pedidosDiaRows, (r) => [r.dia, Number(r.pedidos)]));
    const volumenPorDiaMap = new Map(Array.from(volumenDiaRows, (r) => [r.dia, Number(r.volumen)]));
    const altasPorMesMap = new Map(Array.from(altasMesRows, (r) => [r.mes, Number(r.altas)]));
    const series = {
      ingresosPorMes: meses.map((mes) => ({
        mes,
        monto: Number(porMes.get(mes)?.monto ?? 0),
        pagos: Number(porMes.get(mes)?.pagos ?? 0),
      })),
      pedidosPorDia: dias.map((dia) => ({
        dia,
        pedidos: pedidosPorDiaMap.get(dia) ?? 0,
        volumen: volumenPorDiaMap.get(dia) ?? 0,
      })),
      altasPorMes: meses.map((mes) => ({ mes, altas: altasPorMesMap.get(mes) ?? 0 })),
      topLocales: Array.from(topRows, (r) => ({
        id: r.id,
        nombre: r.nombre,
        slug: r.slug,
        volumen30d: Number(r.volumen),
        pedidos30d: Number(r.pedidos),
      })).filter((l) => l.volumen30d > 0 || l.pedidos30d > 0),
    };

    return {
      total: Number(conteos?.total ?? 0),
      activos: Number(conteos?.activos ?? 0),
      trial: Number(conteos?.trial ?? 0),
      exempt: Number(conteos?.exempt ?? 0),
      pastDue: Number(conteos?.pastDue ?? 0),
      inactive: Number(conteos?.inactive ?? 0),
      activosPago: Number(conteos?.activosPago ?? 0),
      nuevosMes: Number(conteos?.nuevosMes ?? 0),
      ingresos: {
        mesActual: Number(ingresos?.mesActual ?? 0),
        mesAnterior: Number(ingresos?.mesAnterior ?? 0),
        total: Number(ingresos?.total ?? 0),
        pagosMesActual: Number(ingresos?.pagosMesActual ?? 0),
      },
      mrr,
      porVencer: { trial7: Number(conteos?.trial7 ?? 0), periodo7: Number(conteos?.periodo7 ?? 0) },
      uso: {
        pedidos30d: Number(uso?.pedidos30d ?? 0),
        volumen30d: Number(uso?.volumen30d ?? 0),
        pedidosHoy: Number(uso?.pedidosHoy ?? 0),
        localesConActividad7d: Number(uso?.localesConActividad7d ?? 0),
      },
      pagosRecientes: pagos.map((pg) => ({
        id: pg.id,
        fecha: pg.fecha.toISOString(),
        localId: pg.localId,
        localNombre: pg.localNombre,
        localSlug: pg.localSlug,
        plan: (isPlanId(pg.plan) ? pg.plan : 'pro') as PlanId,
        monto: Number(pg.monto),
        estado: pg.estado,
      })),
      atencion: atencion.slice(0, 20),
      series,
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
