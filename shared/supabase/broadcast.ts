import { createSupabaseAdminClient } from './admin';

/**
 * Broadcast Realtime desde el servidor (server actions, webhooks).
 *
 * Usa el cliente admin + `httpSend` (REST, ~60 ms): no depende de un
 * WebSocket ni de las cookies del caller, así el aviso llega igual cuando lo
 * dispara un comensal sin sesión o un webhook de Mercado Pago. Antes cada
 * action armaba su propio `createSupabaseServerClient().channel().send()`,
 * que hoy cae a REST con un warning de deprecación.
 *
 * Canales:
 * - `admin_restaurant_{tenantId}`: panel del local (cocina, campana, plano, cobros).
 * - `mesa_{sesionMesaId}`: pantalla del comensal (carrito compartido, ticket, seguimiento).
 *
 * Best-effort: nunca lanza; devuelve true si Realtime aceptó el mensaje.
 */
export async function broadcastEvent(
  topic: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const channel = supabase.channel(topic);
    try {
      // POST /realtime/v1/api/broadcast/{topic}/events/{event}; no hace falta subscribe().
      await channel.httpSend(event, payload);
      return true;
    } finally {
      await supabase.removeChannel(channel);
    }
  } catch (error) {
    console.error(`[broadcastEvent] ${topic} / ${event}:`, error);
    return false;
  }
}

/** Aviso al panel del local. */
export function broadcastAdminEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  return broadcastEvent(`admin_restaurant_${tenantId}`, event, payload);
}

/** Aviso a la pantalla del comensal de una sesión de mesa / pedido online. */
export function broadcastMesaEvent(
  sesionMesaId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  return broadcastEvent(`mesa_${sesionMesaId}`, event, payload);
}
