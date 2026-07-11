'use server';

import { sesionesMesa, datosEntrega } from '@/shared/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant, withPublicTenant } from '@/shared/db/secure-wrapper';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  resolverLineasBulk,
  inserirPedidoDesdeLineas,
  type PedidoItemInput,
} from '@/features/pedidos/crearPedidoCore';
import { obtenerDeliveryConfig } from './deliveryConfigActions';
import { modosPermitidos } from './deliveryConfig';

type TipoExterno = 'takeaway' | 'delivery';

const ESTADOS_ENTREGA = [
  'Recibido',
  'EnPreparacion',
  'Listo',
  'EnCamino',
  'Entregado',
  'Cancelado',
] as const;
type EstadoEntrega = (typeof ESTADOS_ENTREGA)[number];

type Contacto = {
  nombreContacto: string;
  telefono: string;
  direccion?: string;
  referencia?: string;
  costoEnvio?: number;
  horaEstimada?: string; // ISO
};

/** Avisa al panel admin que entró/cambió un pedido externo. */
async function broadcastOrdenExterna(
  tenantId: string,
  event: 'orden_externa_nueva' | 'orden_externa_actualizada' | 'nuevo_pedido',
  payload: Record<string, unknown>,
) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.channel(`admin_restaurant_${tenantId}`).send({ type: 'broadcast', event, payload });
  } catch (e) {
    console.warn('[broadcastOrdenExterna]', e);
  }
}

/**
 * Flujo público (sin login) "menú primero": recibe el carrito ya armado + los
 * datos de contacto/entrega del checkout y crea TODO de una (sesión sin mesa +
 * datos de entrega + pedido con items) en una sola transacción. Sólo después de
 * confirmar avisa al panel admin — así no quedan pedidos fantasma. Devuelve el
 * `sesionId` para redirigir a la pantalla de confirmación/pago (/pedir?sesion=).
 */
export async function crearPedidoExternoAction(
  tenantSlug: string,
  tipo: TipoExterno,
  contacto: Contacto,
  items: PedidoItemInput[],
) {
  try {
    if (!tenantSlug?.trim() || tenantSlug.length > 64) {
      return { success: false, message: 'Restaurante inválido' };
    }
    const tenantId = await getTenantBySlug(tenantSlug);
    if (!tenantId) {
      return { success: false, message: 'Restaurante no encontrado' };
    }
    if (tipo !== 'takeaway' && tipo !== 'delivery') {
      return { success: false, message: 'Tipo de pedido inválido' };
    }

    const itemsLimpios = (items ?? [])
      .filter((i) => i.productoId && i.cantidad > 0)
      .slice(0, 50)
      .map((i) => ({
        ...i,
        cantidad: Math.min(99, Math.max(1, Math.floor(Number(i.cantidad) || 0))),
      }))
      .filter((i) => i.cantidad > 0);
    if (itemsLimpios.length === 0) {
      return { success: false, message: 'El carrito está vacío' };
    }
    if (!contacto.nombreContacto?.trim() || !contacto.telefono?.trim()) {
      return { success: false, message: 'Nombre y teléfono son obligatorios' };
    }
    if (
      contacto.nombreContacto.trim().length > 120 ||
      contacto.telefono.trim().length > 40 ||
      (contacto.direccion?.trim().length ?? 0) > 300
    ) {
      return { success: false, message: 'Datos de contacto inválidos' };
    }
    if (tipo === 'delivery' && !contacto.direccion?.trim()) {
      return { success: false, message: 'La dirección es obligatoria para envíos' };
    }

    // Config de delivery e ítems del carrito resueltos en PARALELO antes de abrir
    // la transacción. `resolverLineasBulk` usa `db` (fuera de tx) y hace todas las
    // lecturas de producto/precio/modificadores en lote; hacerlo dentro del lock
    // de la transacción alargaba innecesariamente el tiempo de espera en la DB.
    const [config, lineasResueltas] = await Promise.all([
      obtenerDeliveryConfig(tenantId),
      resolverLineasBulk(
        tenantId,
        itemsLimpios.map((i) => ({
          productoId: i.productoId,
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          modificadores: (i.modificadores ?? []).map((m) => ({ id: m.id })),
        })),
      ),
    ]);

    if (!config.activo) {
      return { success: false, message: 'El local no está tomando pedidos online en este momento' };
    }
    if (!modosPermitidos(config).includes(tipo)) {
      return { success: false, message: 'Esa modalidad de pedido no está disponible' };
    }

    const { sesionId } = await withPublicTenant(tenantId, async (tx) => {
      const [sesion] = await tx
        .insert(sesionesMesa)
        .values({ restauranteId: tenantId, mesaId: null, tipo, estado: 'Activa' })
        .returning({ id: sesionesMesa.id });

      // datosEntrega + pedido con items son independientes entre sí: van en
      // paralelo dentro de la transacción. Los items ya están resueltos (nombres,
      // precios, variantes) así que los inserts son solo escrituras.
      await Promise.all([
        tx.insert(datosEntrega).values({
          restauranteId: tenantId,
          sesionMesaId: sesion.id,
          nombreContacto: contacto.nombreContacto.trim(),
          telefono: contacto.telefono.trim(),
          direccion: contacto.direccion?.trim() || null,
          referencia: contacto.referencia?.trim() || null,
          costoEnvio: (contacto.costoEnvio ?? 0).toString(),
          horaEstimada: contacto.horaEstimada ? new Date(contacto.horaEstimada) : null,
          estadoEntrega: 'Recibido',
        }),
        inserirPedidoDesdeLineas(tx, { tenantId, sesionMesaId: sesion.id, lineas: lineasResueltas }),
      ]);

      return { sesionId: sesion.id };
    });

    // Fire-and-forget: el broadcast no afecta al comensal y no debe alargar el
    // tiempo de respuesta percibido. Los errores se loguean dentro de la función.
    void broadcastOrdenExterna(tenantId, 'orden_externa_nueva', { sesionMesaId: sesionId, tipo });
    // Misma señal que el salón: cocina y campana del panel escuchan `nuevo_pedido`.
    void broadcastOrdenExterna(tenantId, 'nuevo_pedido', {
      sesionMesaId: sesionId,
      etiqueta: tipo === 'delivery' ? 'Delivery' : 'Takeaway',
    });

    return { success: true, sesionId, tenantId };
  } catch (error) {
    console.error('[crearPedidoExternoAction]', error);
    return { success: false, message: 'No se pudo crear el pedido' };
  }
}

/** Item agregado de un pedido externo, para mostrar "qué pidió" en el tablero. */
export type OrdenExternaItem = {
  nombre: string;
  cantidad: number;
  modificadores: string[];
};

/**
 * Tablero de admin: pedidos de retiro/envío con su estado de entrega, el detalle
 * de lo pedido (items + total) y si está pagado, para que el staff decida si
 * preparar — sin tener que entrar a cada pedido para ver qué se pidió.
 */
export async function getOrdenesExternasAction() {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageDelivery')) {
      return { success: false, message: 'No autorizado', ordenes: [] as const };
    }

    const base = await withTenant(claimsFromSession(session), (db) =>
      db
        .select({
          sesionMesaId: sesionesMesa.id,
          tipo: sesionesMesa.tipo,
          estadoSesion: sesionesMesa.estado,
          createdAt: sesionesMesa.createdAt,
          nombreContacto: datosEntrega.nombreContacto,
          telefono: datosEntrega.telefono,
          direccion: datosEntrega.direccion,
          referencia: datosEntrega.referencia,
          costoEnvio: datosEntrega.costoEnvio,
          estadoEntrega: datosEntrega.estadoEntrega,
          horaEstimada: datosEntrega.horaEstimada,
        })
        .from(datosEntrega)
        .innerJoin(sesionesMesa, eq(datosEntrega.sesionMesaId, sesionesMesa.id))
        .where(eq(datosEntrega.restauranteId, session.restauranteId))
        .orderBy(desc(sesionesMesa.createdAt))
    );

    const sesionIds = base.map((o) => o.sesionMesaId);
    if (sesionIds.length === 0) {
      return { success: true, ordenes: [] };
    }

    // Detalle de lo pedido (pedidos no cancelados + items + modificadores) y los
    // pagos aprobados, en lotes (no N+1) para todas las sesiones del tablero.
    const [pedidosData, pagosAprobados] = await withTenant(claimsFromSession(session), (db) =>
      Promise.all([
        db.query.pedidos.findMany({
          where: (t, { and, ne, inArray }) =>
            and(inArray(t.sesionMesaId, sesionIds), ne(t.estado, 'Cancelado')),
          with: { items: { with: { modificadores: true } } },
        }),
        db.query.transaccionesPago.findMany({
          where: (t, { and, eq, inArray }) =>
            and(inArray(t.sesionMesaId, sesionIds), eq(t.estado, 'Aprobado')),
        }),
      ])
    );

    // Items agregados + total por sesión.
    const itemsPorSesion = new Map<string, OrdenExternaItem[]>();
    const totalPorSesion = new Map<string, number>();
    for (const pedido of pedidosData) {
      const sid = pedido.sesionMesaId;
      const lista = itemsPorSesion.get(sid) ?? [];
      for (const item of pedido.items) {
        const mods = item.modificadores ?? [];
        const precioMods = mods.reduce((acc, m) => acc + (Number(m.precioExtraSnapshot) || 0), 0);
        const precioUnitario = Number(item.precioUnitarioSnapshot || 0) + precioMods;
        const cantidad = Number(item.cantidad);
        lista.push({
          nombre: item.nombreProductoSnapshot || 'Producto',
          cantidad,
          modificadores: mods.map((m) => m.nombreModificadorSnapshot),
        });
        totalPorSesion.set(sid, (totalPorSesion.get(sid) ?? 0) + cantidad * precioUnitario);
      }
      itemsPorSesion.set(sid, lista);
    }

    const pagadoPorSesion = new Map<string, number>();
    for (const tx of pagosAprobados) {
      pagadoPorSesion.set(
        tx.sesionMesaId,
        (pagadoPorSesion.get(tx.sesionMesaId) ?? 0) + Number(tx.monto),
      );
    }

    const ordenes = base.map((o) => {
      const total = totalPorSesion.get(o.sesionMesaId) ?? 0;
      const pagado = pagadoPorSesion.get(o.sesionMesaId) ?? 0;
      return {
        ...o,
        items: itemsPorSesion.get(o.sesionMesaId) ?? [],
        total,
        // Pagado cuando hay pagos aprobados que cubren el total (> 0).
        estadoPago: total > 0 && pagado >= total ? ('Pagado' as const) : ('Pendiente' as const),
      };
    });

    return { success: true, ordenes };
  } catch (error) {
    console.error('[getOrdenesExternasAction]', error);
    return { success: false, message: 'Error al cargar pedidos', ordenes: [] as const };
  }
}

/**
 * Avanza el estado de entrega de un pedido externo (staff). Al Entregar o
 * Cancelar, cierra la sesión para que no quede "abierta".
 */
export async function cambiarEstadoEntregaAction(sesionMesaId: string, nuevoEstado: EstadoEntrega) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageDelivery')) {
      return { success: false, message: 'No autorizado' };
    }
    if (!ESTADOS_ENTREGA.includes(nuevoEstado)) {
      return { success: false, message: 'Estado inválido' };
    }

    await withTenant(claimsFromSession(session), async (tx) => {
      await tx
        .update(datosEntrega)
        .set({ estadoEntrega: nuevoEstado, updatedAt: new Date() })
        .where(
          and(
            eq(datosEntrega.sesionMesaId, sesionMesaId),
            eq(datosEntrega.restauranteId, session.restauranteId),
          ),
        );

      // Entregado/Cancelado cierran la sesión; volver a un estado en curso (p. ej.
      // arrastrando la tarjeta hacia atrás en el tablero) la reabre.
      const terminal = nuevoEstado === 'Entregado' || nuevoEstado === 'Cancelado';
      await tx
        .update(sesionesMesa)
        .set({ estado: terminal ? 'Cerrada' : 'Activa', updatedAt: new Date() })
        .where(
          and(
            eq(sesionesMesa.id, sesionMesaId),
            eq(sesionesMesa.restauranteId, session.restauranteId),
          ),
        );
    });

    await broadcastOrdenExterna(session.restauranteId, 'orden_externa_actualizada', {
      sesionMesaId,
      estadoEntrega: nuevoEstado,
    });

    // Avisar al cliente que está siguiendo su pedido (canal de su sesión), para
    // que la pantalla de seguimiento avance el estado sin recargar.
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.channel(`mesa_${sesionMesaId}`).send({
        type: 'broadcast',
        event: 'estado_entrega_actualizado',
        payload: { estadoEntrega: nuevoEstado },
      });
    } catch (e) {
      console.warn('[cambiarEstadoEntregaAction] realtime seguimiento', e);
    }

    revalidatePath('/admin/pedidos-online');
    return { success: true, message: 'Estado actualizado' };
  } catch (error) {
    console.error('[cambiarEstadoEntregaAction]', error);
    return { success: false, message: 'Error al actualizar estado' };
  }
}
