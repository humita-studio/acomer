'use server';

import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/shared/db';
import { staffAlerts } from '@/shared/db/schema';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { withTenant } from '@/shared/db/secure-wrapper';
import { broadcastAdminEvent } from '@/shared/supabase/broadcast';

export type StaffAlertDto = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  href: string | null;
  createdAt: Date;
};

const RECIENTES_MIN = 45;

/**
 * Crea una alerta persistida + broadcast al canal del admin.
 * Usa el `db` de módulo (bypass RLS) para que el comensal (sin sesión staff)
 * pueda avisar al personal.
 */
export async function crearStaffAlert(opts: {
  restauranteId: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  href?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; alert?: StaffAlertDto; message?: string }> {
  try {
    const [row] = await db
      .insert(staffAlerts)
      .values({
        restauranteId: opts.restauranteId,
        tipo: opts.tipo,
        titulo: opts.titulo,
        cuerpo: opts.cuerpo,
        href: opts.href ?? null,
        metadata: opts.metadata ?? {},
      })
      .returning({
        id: staffAlerts.id,
        tipo: staffAlerts.tipo,
        titulo: staffAlerts.titulo,
        cuerpo: staffAlerts.cuerpo,
        href: staffAlerts.href,
        createdAt: staffAlerts.createdAt,
      });

    if (!row) {
      return { success: false, message: 'No se pudo guardar el aviso' };
    }

    // Un solo broadcast por alerta (antes mandábamos llamar_mozo + alerta_mesa
    // y la campana/plano mostraban el aviso dos veces).
    const payload = {
      id: row.id,
      tipo: row.tipo,
      titulo: row.titulo,
      cuerpo: row.cuerpo,
      href: row.href,
      createdAt: row.createdAt.toISOString(),
      ...(opts.metadata ?? {}),
    };

    // Best-effort: aunque falle el live, la campana la trae de DB al refetch.
    await broadcastAdminEvent(opts.restauranteId, opts.tipo, payload);

    return {
      success: true,
      alert: {
        id: row.id,
        tipo: row.tipo,
        titulo: row.titulo,
        cuerpo: row.cuerpo,
        href: row.href,
        createdAt: row.createdAt,
      },
    };
  } catch (error) {
    console.error('[crearStaffAlert]', error);
    return { success: false, message: 'No se pudo crear el aviso' };
  }
}

/** Últimas alertas del restaurante (ventana corta) para la campana del staff. */
export async function getAlertasStaffRecientesAction(): Promise<StaffAlertDto[]> {
  try {
    const session = await getCurrentSession();
    if (!session) return [];

    const since = new Date(Date.now() - RECIENTES_MIN * 60 * 1000);

    return await withTenant(claimsFromSession(session), async (tx) => {
      const rows = await tx
        .select({
          id: staffAlerts.id,
          tipo: staffAlerts.tipo,
          titulo: staffAlerts.titulo,
          cuerpo: staffAlerts.cuerpo,
          href: staffAlerts.href,
          createdAt: staffAlerts.createdAt,
        })
        .from(staffAlerts)
        .where(
          and(
            eq(staffAlerts.restauranteId, session.restauranteId),
            gte(staffAlerts.createdAt, since),
          ),
        )
        .orderBy(desc(staffAlerts.createdAt))
        .limit(20);

      return rows;
    });
  } catch (error) {
    console.error('[getAlertasStaffRecientesAction]', error);
    return [];
  }
}
