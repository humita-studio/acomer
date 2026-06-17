'use server';

import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { obtenerTicketMesa, type TicketItem } from './obtener-ticket-mesa';

/**
 * Wrapper server-action de `obtenerTicketMesa` para consumirlo como `queryFn`
 * de TanStack Query desde el panel del mozo. (No se puede usar `obtenerTicketMesa`
 * directo: su módulo exporta tipos, así que no puede llevar `'use server'`.)
 */
export async function obtenerTicketMesaAction(
  sesionMesaId: string,
): Promise<{ items: TicketItem[]; total: number }> {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canTakeOrders')) {
    return { items: [], total: 0 };
  }
  return obtenerTicketMesa(sesionMesaId);
}
