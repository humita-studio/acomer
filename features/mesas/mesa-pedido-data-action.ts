'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import type { CategoriaMenu, ProductoMenu } from '@/features/carta/types';
import { obtenerTicketMesa, type TicketItem } from '@/features/pedidos/obtenerTicketMesa';
import { mesas, sesionesMesa } from '@/shared/db/schema';
import { withTenant } from '@/shared/db/secure-wrapper';

export type MesaPedidoData = {
  mesaId: string;
  identificador: string;
  sesionId: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
  ticket: { items: TicketItem[]; total: number };
  canLiberar: boolean;
};

/**
 * Datos para el modal de pedido del staff (carta + ticket + sesión activa).
 * Si la mesa no tiene sesión, devuelve error (abrirla antes con `abrirMesaAction`).
 */
export async function getMesaPedidoDataAction(
  mesaId: string,
): Promise<{ success: true; data: MesaPedidoData } | { success: false; message: string }> {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canTakeOrders')) {
      return { success: false, message: 'No tenés permiso para tomar pedidos' };
    }

    const tenantId = session.restauranteId;
    const canLiberar = hasPermission(session.role, 'canManageTables');

    const row = await withTenant(claimsFromSession(session), async (db) => {
      const [mesa] = await db
        .select({
          id: mesas.id,
          identificador: mesas.identificador,
        })
        .from(mesas)
        .where(
          and(eq(mesas.id, mesaId), eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt)),
        )
        .limit(1);
      if (!mesa) return null;

      const [sesion] = await db
        .select({ id: sesionesMesa.id })
        .from(sesionesMesa)
        .where(
          and(
            eq(sesionesMesa.mesaId, mesaId),
            eq(sesionesMesa.restauranteId, tenantId),
            eq(sesionesMesa.estado, 'Activa'),
          ),
        )
        .limit(1);

      return { mesa, sesion: sesion ?? null };
    });

    if (!row) return { success: false, message: 'Mesa no encontrada' };
    if (!row.sesion) {
      return { success: false, message: 'La mesa no tiene una sesión activa' };
    }

    const [{ categorias, productos }, ticket] = await Promise.all([
      obtenerCarta(tenantId),
      obtenerTicketMesa(row.sesion.id),
    ]);

    return {
      success: true,
      data: {
        mesaId: row.mesa.id,
        identificador: row.mesa.identificador,
        sesionId: row.sesion.id,
        categorias: categorias as CategoriaMenu[],
        productos,
        ticket,
        canLiberar,
      },
    };
  } catch (error) {
    console.error('[getMesaPedidoDataAction]', error);
    return { success: false, message: 'No se pudo cargar el pedido de la mesa' };
  }
}
