'use server';

import { mesas, perfilesEmpleados } from '@/shared/db/schema';
import { eq, and, isNull, ne } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { getEmailsByUserIds } from '@/features/auth/authUsers';
import { broadcastMesaEvent } from '@/shared/supabase/broadcast';
import { abrirOReusarSesion, broadcastOcupacion } from '@/features/comanda/sesion-mesa-core';
import { revalidatePath } from 'next/cache';

// El `db` de cada acción es el handle transaccional de withTenant (RLS activo).
// Los helpers (abrirOReusarSesion, broadcastOcupacion) usan su propio db de
// módulo y todavía no están escopados por RLS.

export async function crearMesa(identificador: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar mesas' };
    }

    // Límite de mesas del plan
    const { getBillingSnapshotAction } = await import('@/features/billing/billingActions');
    const billing = await getBillingSnapshotAction();
    if (billing?.maxMesas != null) {
      const { countMesasActivas } = await import('@/features/billing/limits');
      const n = await countMesasActivas(session.restauranteId);
      if (n >= billing.maxMesas) {
        return {
          success: false,
          message: `Tu plan permite hasta ${billing.maxMesas} mesas. Pasate a Pro o eliminá alguna mesa.`,
        };
      }
    }

    await withTenant(claimsFromSession(session), (db) =>
      db.insert(mesas).values({
        restauranteId: session.restauranteId,
        identificador,
      })
    );

    revalidatePath('/admin/mesas');
    return { success: true, message: 'Mesa creada' };
  } catch (error) {
    console.error('[crearMesa]', error);
    return { success: false, message: 'Error al crear la mesa' };
  }
}

export async function eliminarMesa(id: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar mesas' };
    }

    // Soft delete
    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(mesas)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(mesas.id, id),
            eq(mesas.restauranteId, session.restauranteId)
          )
        )
    );

    revalidatePath('/admin/mesas');
    return { success: true, message: 'Mesa eliminada' };
  } catch (error) {
    console.error('[eliminarMesa]', error);
    return { success: false, message: 'Error al eliminar la mesa' };
  }
}

export async function liberarMesaAction(mesaId: string, forzar = false) {
  try {
    const session = await getCurrentSession();
    // La libera quien gestiona mesas (owner/admin) o quien toma pedidos (mozo)
    if (!session || (!hasPermission(session.role, 'canManageTables') && !hasPermission(session.role, 'canTakeOrders'))) {
      return { success: false, message: 'No tenés permiso para liberar la mesa' };
    }

    const { sesionesMesa, pedidos, transaccionesPago } = await import('@/shared/db/schema');

    // Buscar la sesión activa de esta mesa
    const sesion = await withTenant(claimsFromSession(session), (db) =>
      db.query.sesionesMesa.findFirst({
        where: and(
          eq(sesionesMesa.mesaId, mesaId),
          eq(sesionesMesa.restauranteId, session.restauranteId),
          eq(sesionesMesa.estado, 'Activa'),
        ),
      })
    );

    if (!sesion) {
      await broadcastOcupacion(session.restauranteId, mesaId, false);
      revalidatePath('/admin/mesas');
      return { success: true, message: 'Mesa liberada correctamente' };
    }

    // Si no se forzó el cierre, verificar si hay deuda pendiente
    if (!forzar) {
      const [pedidosMesa, pagosAprobados] = await withTenant(claimsFromSession(session), (db) =>
        Promise.all([
          db.query.pedidos.findMany({
            where: and(eq(pedidos.sesionMesaId, sesion.id), ne(pedidos.estado, 'Cancelado')),
            columns: { total: true },
          }),
          db.query.transaccionesPago.findMany({
            where: and(eq(transaccionesPago.sesionMesaId, sesion.id), eq(transaccionesPago.estado, 'Aprobado')),
            columns: { monto: true },
          }),
        ])
      );

      const totalConsumido = pedidosMesa.reduce((acc, p) => acc + Number(p.total), 0);
      const totalPagado = pagosAprobados.reduce((acc, tx) => acc + Number(tx.monto), 0);
      const saldoPendiente = totalConsumido - totalPagado;

      if (saldoPendiente > 0.01) {
        return {
          success: false,
          requiereConfirmacion: true,
          saldoPendiente,
          message: `La mesa tiene un saldo pendiente de $${saldoPendiente.toLocaleString('es-AR')}. ¿Querés liberarla igualmente?`,
        };
      }
    }

    // Cerramos la sesión activa
    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(sesionesMesa)
        .set({ estado: 'Cerrada' })
        .where(eq(sesionesMesa.id, sesion.id))
    );

    // Avisar al comensal en tiempo real para que refresque su pantalla
    await broadcastMesaEvent(sesion.id, 'sesion_cerrada', { mesaId, sesionId: sesion.id });

    // Avisar al panel admin (plano del local) que la mesa pasó a libre
    await broadcastOcupacion(session.restauranteId, mesaId, false);

    revalidatePath('/admin/mesas');
    return { success: true, message: 'Mesa liberada correctamente' };
  } catch (error) {
    console.error('[liberarMesaAction]', error);
    return { success: false, message: 'Error al liberar la mesa' };
  }
}

/**
 * Abre (u ocupa) una mesa desde el panel del staff, sin necesidad de que el
 * comensal escanee el QR. La usa el mozo cuando toma el pedido en la mesa.
 * Idempotente: si ya hay una sesión activa, devuelve esa.
 */
export async function abrirMesaAction(mesaId: string) {
  try {
    const session = await getCurrentSession();
    // La abre quien toma pedidos (mozo) o quien gestiona mesas (owner/admin)
    if (
      !session ||
      (!hasPermission(session.role, 'canTakeOrders') && !hasPermission(session.role, 'canManageTables'))
    ) {
      return { success: false, message: 'No tenés permiso para abrir la mesa' };
    }

    const mesa = await withTenant(claimsFromSession(session), async (db) => {
      const [m] = await db
        .select({ id: mesas.id, identificador: mesas.identificador })
        .from(mesas)
        .where(
          and(
            eq(mesas.id, mesaId),
            eq(mesas.restauranteId, session.restauranteId),
            isNull(mesas.deletedAt),
          ),
        )
        .limit(1);
      return m;
    });
    if (!mesa) return { success: false, message: 'Mesa no encontrada' };

    const { sesionId } = await abrirOReusarSesion(session.restauranteId, mesa);

    revalidatePath('/admin/mesas');
    return { success: true, sesionId };
  } catch (error) {
    console.error('[abrirMesaAction]', error);
    return { success: false, message: 'Error al abrir la mesa' };
  }
}

// ---------------------------------------------------------------------------
// Asignación de mozos a mesas
// ---------------------------------------------------------------------------

export type MozoOption = {
  userId: string;
  /** Parte local del email, para mostrar en UI. */
  label: string;
  email: string;
};

/** Etiqueta corta legible a partir del email (antes del @). No exportar: en 'use server' solo van async actions. */
function labelDesdeEmail(email: string): string {
  const local = email.split('@')[0]?.trim() || email;
  return local || 'Mozo';
}

/**
 * Mozos activos del local (para el selector de asignación).
 * Visible a quien gestiona mesas o toma pedidos.
 */
export async function listMozosAction(): Promise<MozoOption[]> {
  try {
    const session = await getCurrentSession();
    if (
      !session ||
      (!hasPermission(session.role, 'canManageTables') &&
        !hasPermission(session.role, 'canTakeOrders'))
    ) {
      return [];
    }

    const perfiles = await withTenant(claimsFromSession(session), (db) =>
      db
        .select({
          userId: perfilesEmpleados.userId,
        })
        .from(perfilesEmpleados)
        .where(
          and(
            eq(perfilesEmpleados.restauranteId, session.restauranteId),
            eq(perfilesEmpleados.rol, 'mozo'),
            eq(perfilesEmpleados.activo, true),
          ),
        ),
    );

    if (perfiles.length === 0) return [];

    let emailPorUserId = new Map<string, string>();
    try {
      emailPorUserId = await getEmailsByUserIds(perfiles.map((p) => p.userId));
    } catch (e) {
      console.error('[listMozosAction] emails:', e);
    }

    return perfiles
      .map((p) => {
        const email = emailPorUserId.get(p.userId) ?? '';
        return {
          userId: p.userId,
          email: email || '(sin email)',
          label: email ? labelDesdeEmail(email) : 'Mozo',
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  } catch (error) {
    console.error('[listMozosAction]', error);
    return [];
  }
}

/**
 * Asigna o desasigna un mozo a una mesa.
 * `mozoUserId` null quita la asignación. Sólo quien gestiona mesas.
 */
export async function asignarMozoMesaAction(
  mesaId: string,
  mozoUserId: string | null,
): Promise<{ success: boolean; message?: string }> {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para asignar mesas' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [mesa] = await db
        .select({ id: mesas.id })
        .from(mesas)
        .where(
          and(
            eq(mesas.id, mesaId),
            eq(mesas.restauranteId, session.restauranteId),
            isNull(mesas.deletedAt),
          ),
        )
        .limit(1);
      if (!mesa) return { success: false, message: 'Mesa no encontrada' };

      if (mozoUserId) {
        const [mozo] = await db
          .select({ userId: perfilesEmpleados.userId })
          .from(perfilesEmpleados)
          .where(
            and(
              eq(perfilesEmpleados.userId, mozoUserId),
              eq(perfilesEmpleados.restauranteId, session.restauranteId),
              eq(perfilesEmpleados.rol, 'mozo'),
              eq(perfilesEmpleados.activo, true),
            ),
          )
          .limit(1);
        if (!mozo) {
          return { success: false, message: 'El mozo no es válido o no está activo' };
        }
      }

      await db
        .update(mesas)
        .set({ mozoUserId })
        .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, session.restauranteId)));

      return { success: true, message: mozoUserId ? 'Mozo asignado' : 'Asignación quitada' };
    });

    if (res.success) revalidatePath('/admin/mesas');
    return res;
  } catch (error) {
    console.error('[asignarMozoMesaAction]', error);
    return { success: false, message: 'No se pudo asignar el mozo' };
  }
}
