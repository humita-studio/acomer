'use server';

import { db } from '@/shared/db';
import {
  sesionesMesa,
  transaccionesPago,
  pedidos,
  restaurantes,
} from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { getMetodosPago, type MetodoPago } from '@/features/pagos/get-metodos-pago';
import { getPaymentProvider } from '@/features/pagos/core/payment-factory';
import { crearPedidoConItemsStaff, esItemLibre, type StaffItemInput } from '@/features/pedidos/crearPedidoCore';
import { calcularPromosStaff } from '@/features/promociones/cobroPromosActions';
import type { PromoMetodoPago } from '@/features/promociones/promociones';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import type { ProductoMenu, CategoriaMenu } from '@/features/carta/types';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import {
  getSesionCajaAbiertaId,
  requireSesionCajaAbierta,
} from '@/features/caja/sesionCaja';

/**
 * Venta de mostrador: el cajero arma un pedido y lo cobra en el acto, sin mesa.
 * Reusa toda la maquinaria de `sesiones_mesa` (igual que takeaway/delivery): el
 * carrito se arma local en el modal y recién se persiste al cobrar, evitando
 * sesiones fantasma. El permiso es de caja (`canProcessPayments`), no de mozo
 * (`canTakeOrders`), porque el cajero es quien hace estas ventas.
 *
 * Dos ejes independientes (venta rápida ≠ sin cocina):
 *  - Pago: transacción `Aprobado` al confirmar (efectivo/tarjeta) o al webhook (MP).
 *  - Prep: el pedido queda `Pendiente` y entra al KDS como "Mostrador" para que
 *    cocina sepa qué hacer (Pendiente → En prep. → Listo → Entregado).
 *  - Sesión: se cierra (one-shot, sin mesa). Caja/reportes miran la transacción.
 */

type MetodoMostrador = 'efectivo' | 'tarjeta_fisica';

export type VentaMostradorTicketLinea = {
  nombre: string;
  cantidad: number;
  subtotal: number;
};

export type VentaMostradorTicket = {
  sesionId: string;
  pedidoId: string;
  pedidoRef: string;
  /** Subtotal sin descuento (bruto). */
  subtotal: number;
  /** Descuento por promociones aplicado. */
  descuento: number;
  /** Total cobrado (ya con descuento). */
  total: number;
  metodo: MetodoMostrador | 'mercado_pago';
  vuelto: number;
  cantidadItems: number;
  horaISO: string;
  /** Referencia opcional del cajero (nombre del cliente). */
  nombreReferencia?: string | null;
  /** Líneas para imprimir el ticket. */
  lineas: VentaMostradorTicketLinea[];
};

// ---------------------------------------------------------------------------
// Helpers internos (no exportados: en un archivo 'use server' solo se exportan
// server actions async).
// ---------------------------------------------------------------------------

async function requireCaja() {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canProcessPayments')) return null;
  return session;
}

function filtrarItemsValidos(items: StaffItemInput[]): StaffItemInput[] {
  return (items ?? []).filter(
    (i) => i.cantidad > 0 && (i.productoId || (esItemLibre(i) && Number(i.precioLibre) > 0)),
  );
}

function contarItems(items: StaffItemInput[]): number {
  return items.reduce((acc, i) => acc + i.cantidad, 0);
}

/** Mapea el método del mostrador al método que entienden las condiciones de promo. */
function metodoPromo(metodo: MetodoMostrador | 'mercado_pago'): PromoMetodoPago {
  if (metodo === 'efectivo') return 'efectivo';
  if (metodo === 'mercado_pago') return 'mercado_pago';
  return 'tarjeta';
}

/**
 * Calcula promos (canal mostrador) sobre el carrito local todavía sin persistir.
 * Si algo falla, se cobra sin descuento (la promo es un beneficio, no debe romper
 * el cobro). Devuelve subtotal, descuento y el snapshot de promos aplicadas.
 */
async function promosDeVenta(
  tenantId: string,
  items: StaffItemInput[],
  metodo: MetodoMostrador | 'mercado_pago',
  omitirIds?: string[],
) {
  try {
    return await calcularPromosStaff(tenantId, items, {
      metodoPago: metodoPromo(metodo),
      canal: 'mostrador',
      omitirIds,
    });
  } catch (error) {
    console.warn('[ventaMostrador] promos no aplicadas:', error);
    return null;
  }
}

/** Cancela una venta de mostrador a medio cobrar (MP no pagado o error). */
async function cancelarVentaInterno(tenantId: string, sesionId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(transaccionesPago)
      .set({ estado: 'Cancelado' })
      .where(and(eq(transaccionesPago.sesionMesaId, sesionId), eq(transaccionesPago.estado, 'Pendiente')));
    await tx.update(pedidos).set({ estado: 'Cancelado' }).where(eq(pedidos.sesionMesaId, sesionId));
    await tx
      .update(sesionesMesa)
      .set({ estado: 'Cerrada' })
      .where(and(eq(sesionesMesa.id, sesionId), eq(sesionesMesa.restauranteId, tenantId)));
  });
}

/** Avisa al KDS + campana. Best-effort (el KDS también pollea cada 30s). */
async function notificarNuevoPedidoMostrador(
  tenantId: string,
  payload: { sesionId: string; pedidoId: string; nombreReferencia?: string | null },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const etiqueta = payload.nombreReferencia?.trim()
      ? `Mostrador · ${payload.nombreReferencia.trim()}`
      : 'Mostrador';
    await supabase.channel(`admin_restaurant_${tenantId}`).send({
      type: 'broadcast',
      event: 'nuevo_pedido',
      payload: {
        sesionMesaId: payload.sesionId,
        pedidoId: payload.pedidoId,
        etiqueta,
      },
    });
  } catch (e) {
    console.warn('[ventaMostrador] realtime nuevo_pedido:', e);
  }
}

// ---------------------------------------------------------------------------
// Catálogo y métodos (para el modal)
// ---------------------------------------------------------------------------

/**
 * Catálogo activo para el selector de productos del mostrador. Mismas queries
 * que la pantalla de pedido de una mesa (`app/admin/mesas/[mesaId]/page.tsx`).
 */
export async function obtenerMenuVentaAction(): Promise<{
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
}> {
  const session = await requireCaja();
  if (!session) return { categorias: [], productos: [] };
  return obtenerCarta(session.restauranteId);
}

/** Medios de pago del local (suma Mercado Pago solo si está configurado). */
export async function obtenerMetodosVentaAction(): Promise<MetodoPago[]> {
  const session = await requireCaja();
  if (!session) return [];
  return getMetodosPago(session.restauranteId);
}

export type PreviewVentaMostrador = {
  subtotal: number;
  descuento: number;
  total: number;
  aplicadas: { id: string; nombre: string; tipo: string; descuento: number }[];
};

/**
 * Preview del cobro para el modal: dado el carrito local y el método elegido,
 * devuelve subtotal/descuento/total y qué promos aplican (canal mostrador). El
 * cajero puede quitar promos con `omitirIds`. El cobro real recalcula por su
 * cuenta, así que esto es sólo para mostrar.
 */
export async function previsualizarVentaMostradorAction(
  items: StaffItemInput[],
  opciones: { metodo: MetodoMostrador | 'mercado_pago'; omitirIds?: string[] },
): Promise<{ success: boolean; preview?: PreviewVentaMostrador }> {
  try {
    const session = await requireCaja();
    if (!session) return { success: false };
    const itemsValidos = filtrarItemsValidos(items);
    if (!itemsValidos.length) {
      return { success: true, preview: { subtotal: 0, descuento: 0, total: 0, aplicadas: [] } };
    }
    const res = await promosDeVenta(
      session.restauranteId,
      itemsValidos,
      opciones.metodo,
      opciones.omitirIds,
    );
    // Si el motor de promos falla, la UI cae a su total local (sin descuento).
    if (!res) return { success: false };
    return {
      success: true,
      preview: {
        subtotal: res.subtotal,
        descuento: res.descuento,
        total: res.total,
        aplicadas: res.aplicadas,
      },
    };
  } catch (error) {
    console.error('[previsualizarVentaMostradorAction]', error);
    return { success: false };
  }
}

// ---------------------------------------------------------------------------
// Cobro síncrono (efectivo / tarjeta): crea, cobra y cierra en una transacción.
// ---------------------------------------------------------------------------

export async function cobrarVentaMostradorAction(
  items: StaffItemInput[],
  opciones: {
    metodoPago: MetodoMostrador;
    nombreReferencia?: string;
    montoRecibido?: number;
    /** Promos que el cajero quitó manualmente. */
    omitirIds?: string[];
  },
): Promise<{ success: boolean; message?: string; ticket?: VentaMostradorTicket }> {
  try {
    const session = await requireCaja();
    if (!session) return { success: false, message: 'No tenés permiso para cobrar' };
    const tenantId = session.restauranteId;

    const { metodoPago } = opciones;
    if (metodoPago !== 'efectivo' && metodoPago !== 'tarjeta_fisica') {
      return { success: false, message: 'Método de pago inválido' };
    }

    const itemsValidos = filtrarItemsValidos(items);
    if (!itemsValidos.length) return { success: false, message: 'No hay productos para cobrar' };
    const cantidadItems = contarItems(itemsValidos);

    // Promos automáticas (canal mostrador) recalculadas en server — no confiamos
    // en el total del cliente.
    const promo = await promosDeVenta(tenantId, itemsValidos, metodoPago, opciones.omitirIds);

    const result = await withTenant(claimsFromSession(session), async (tx) => {
      // Efectivo exige caja abierta; tarjeta se asocia si hay una.
      let sesionCajaId: string | null = null;
      if (metodoPago === 'efectivo') {
        const caja = await requireSesionCajaAbierta(tenantId, tx);
        if (!caja.ok) throw new Error(caja.message);
        sesionCajaId = caja.sesionCajaId;
      } else {
        sesionCajaId = await getSesionCajaAbiertaId(tenantId, tx);
      }

      const [sesion] = await tx
        .insert(sesionesMesa)
        .values({ restauranteId: tenantId, mesaId: null, tipo: 'mostrador', estado: 'Activa' })
        .returning({ id: sesionesMesa.id });

      const { pedidoId, totalPedido } = await crearPedidoConItemsStaff(tx, {
        tenantId,
        sesionMesaId: sesion.id,
        items: itemsValidos,
        notas: opciones.nombreReferencia?.trim() || null,
      });

      const descuento = promo ? Math.min(promo.descuento, totalPedido) : 0;
      const totalNeto = Math.max(0, totalPedido - descuento);
      const promocionId = promo && promo.aplicadas.length === 1 ? promo.aplicadas[0].id : null;

      await tx.insert(transaccionesPago).values({
        restauranteId: tenantId,
        sesionMesaId: sesion.id,
        sesionCajaId,
        proveedor: metodoPago,
        monto: totalNeto.toString(),
        descuento: descuento.toString(),
        promocionId,
        promocionesAplicadas: promo?.aplicadas ?? [],
        estado: 'Aprobado',
        metadata: {
          metodo: metodoPago,
          canal: 'mostrador',
          ...(metodoPago === 'efectivo' && opciones.montoRecibido != null
            ? {
                montoRecibido: Number(opciones.montoRecibido) || 0,
                vuelto: Math.max(0, (Number(opciones.montoRecibido) || 0) - totalNeto),
              }
            : {}),
        },
      });

      // Pago ya cobrado (tx Aprobado). El pedido queda Pendiente para cocina;
      // marcar Pagado lo sacaría del KDS. Sesión cerrada: one-shot sin mesa.
      await tx.update(sesionesMesa).set({ estado: 'Cerrada' }).where(eq(sesionesMesa.id, sesion.id));

      return { sesionId: sesion.id, pedidoId, subtotal: totalPedido, descuento, totalNeto };
    });

    const montoRecibido = Number(opciones.montoRecibido) || 0;
    const vuelto =
      metodoPago === 'efectivo' ? Math.max(0, montoRecibido - result.totalNeto) : 0;

    void notificarNuevoPedidoMostrador(tenantId, {
      sesionId: result.sesionId,
      pedidoId: result.pedidoId,
      nombreReferencia: opciones.nombreReferencia,
    });

    return {
      success: true,
      ticket: {
        sesionId: result.sesionId,
        pedidoId: result.pedidoId,
        pedidoRef: `#${result.pedidoId.slice(0, 4).toUpperCase()}`,
        subtotal: result.subtotal,
        descuento: result.descuento,
        total: result.totalNeto,
        metodo: metodoPago,
        vuelto,
        cantidadItems,
        horaISO: new Date().toISOString(),
        nombreReferencia: opciones.nombreReferencia?.trim() || null,
        lineas: [], // el cliente completa con el carrito local (nombres/precios de UI)
      },
    };
  } catch (error) {
    console.error('[cobrarVentaMostradorAction]', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al cobrar la venta',
    };
  }
}

// ---------------------------------------------------------------------------
// Mercado Pago (asíncrono): crea la venta pendiente + preferencia y devuelve el
// link/QR. El webhook existente aprueba la transacción y cierra la sesión.
// ---------------------------------------------------------------------------

export async function iniciarVentaMostradorMpAction(
  items: StaffItemInput[],
  opciones: { nombreReferencia?: string; omitirIds?: string[] },
): Promise<{
  success: boolean;
  message?: string;
  sesionId?: string;
  transactionId?: string;
  pedidoId?: string;
  paymentUrl?: string;
  subtotal?: number;
  descuento?: number;
  total?: number;
  cantidadItems?: number;
}> {
  try {
    const session = await requireCaja();
    if (!session) return { success: false, message: 'No tenés permiso para cobrar' };
    const tenantId = session.restauranteId;

    const itemsValidos = filtrarItemsValidos(items);
    if (!itemsValidos.length) return { success: false, message: 'No hay productos para cobrar' };
    const cantidadItems = contarItems(itemsValidos);

    // Promos automáticas (canal mostrador, método Mercado Pago).
    const promo = await promosDeVenta(tenantId, itemsValidos, 'mercado_pago', opciones.omitirIds);

    // 1. Persistir sesión + pedido + transacción pendiente (con el total ya descontado).
    const { sesionId, transactionId, pedidoId, subtotal, descuento, total } = await withTenant(claimsFromSession(session), async (tx) => {
      const sesionCajaId = await getSesionCajaAbiertaId(tenantId, tx);

      const [sesion] = await tx
        .insert(sesionesMesa)
        .values({ restauranteId: tenantId, mesaId: null, tipo: 'mostrador', estado: 'Activa' })
        .returning({ id: sesionesMesa.id });

      const { pedidoId, totalPedido } = await crearPedidoConItemsStaff(tx, {
        tenantId,
        sesionMesaId: sesion.id,
        items: itemsValidos,
        notas: opciones.nombreReferencia?.trim() || null,
      });

      const descuento = promo ? Math.min(promo.descuento, totalPedido) : 0;
      const totalNeto = Math.max(0, totalPedido - descuento);
      const promocionId = promo && promo.aplicadas.length === 1 ? promo.aplicadas[0].id : null;

      const [trx] = await tx
        .insert(transaccionesPago)
        .values({
          restauranteId: tenantId,
          sesionMesaId: sesion.id,
          sesionCajaId,
          proveedor: 'mercado_pago',
          monto: totalNeto.toString(),
          descuento: descuento.toString(),
          promocionId,
          promocionesAplicadas: promo?.aplicadas ?? [],
          estado: 'Pendiente',
          metadata: { metodo: 'mercado_pago', canal: 'mostrador' },
        })
        .returning({ id: transaccionesPago.id });

      return {
        sesionId: sesion.id,
        transactionId: trx.id,
        pedidoId,
        subtotal: totalPedido,
        descuento,
        total: totalNeto,
      };
    });

    // 2. Generar la preferencia de pago (QR/link).
    const [rest] = await db
      .select({ nombre: restaurantes.nombre })
      .from(restaurantes)
      .where(eq(restaurantes.id, tenantId))
      .limit(1);

    const provider = await getPaymentProvider(tenantId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const intent = await provider.createPaymentIntent(total, transactionId, {
      restaurantName: rest?.nombre ?? 'Mostrador',
      items: [],
      successUrl: `${baseUrl}/`,
      failureUrl: `${baseUrl}/`,
      pendingUrl: `${baseUrl}/`,
    });

    if (!intent.success || !intent.paymentUrl) {
      await cancelarVentaInterno(tenantId, sesionId);
      return { success: false, message: intent.error || 'No se pudo generar el cobro de Mercado Pago' };
    }

    if (intent.externalReference) {
      await db
        .update(transaccionesPago)
        .set({ referenciaExterna: intent.externalReference })
        .where(eq(transaccionesPago.id, transactionId));
    }

    // Entra a cocina al generar el QR (si cancelan el cobro, se cancela el pedido).
    void notificarNuevoPedidoMostrador(tenantId, {
      sesionId,
      pedidoId,
      nombreReferencia: opciones.nombreReferencia,
    });

    return {
      success: true,
      sesionId,
      transactionId,
      pedidoId,
      paymentUrl: intent.paymentUrl,
      subtotal,
      descuento,
      total,
      cantidadItems,
    };
  } catch (error) {
    console.error('[iniciarVentaMostradorMpAction]', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al iniciar el cobro',
    };
  }
}

/** Estado de la transacción MP, para hacer polling de respaldo mientras se espera. */
export async function estadoVentaMostradorAction(
  transactionId: string,
): Promise<{ estado: string | null }> {
  try {
    const session = await requireCaja();
    if (!session) return { estado: null };
    const [trx] = await withTenant(claimsFromSession(session), (db) =>
      db
        .select({ estado: transaccionesPago.estado })
        .from(transaccionesPago)
        .where(
          and(
            eq(transaccionesPago.id, transactionId),
            eq(transaccionesPago.restauranteId, session.restauranteId),
          ),
        )
        .limit(1)
    );
    return { estado: trx?.estado ?? null };
  } catch (error) {
    console.error('[estadoVentaMostradorAction]', error);
    return { estado: null };
  }
}

/** Cancela una venta MP que el cliente no llegó a pagar. */
export async function cancelarVentaMostradorMpAction(
  sesionId: string,
): Promise<{ success: boolean }> {
  try {
    const session = await requireCaja();
    if (!session) return { success: false };
    await cancelarVentaInterno(session.restauranteId, sesionId);
    return { success: true };
  } catch (error) {
    console.error('[cancelarVentaMostradorMpAction]', error);
    return { success: false };
  }
}
