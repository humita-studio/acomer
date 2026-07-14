import { createSupabaseAdminClient } from './admin';

/**
 * Broadcast al canal del panel admin (`admin_restaurant_{tenantId}`).
 *
 * Usa el cliente admin + `httpSend` (REST): no depende de WebSocket ni de la
 * sesión del comensal. El `channel.send()` del server action del guest a
 * menudo devuelve "ok" en falso o cae a un REST sin permisos y el mozo no ve nada.
 *
 * @returns true si Realtime aceptó el mensaje (HTTP 202).
 */
export async function broadcastAdminEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const topic = `admin_restaurant_${tenantId}`;
  try {
    const supabase = createSupabaseAdminClient();
    const channel = supabase.channel(topic);
    try {
      // httpSend: POST /realtime/v1/api/broadcast/{topic}/events/{event}
      // No hace falta subscribe() previo.
      await channel.httpSend(event, payload);
      return true;
    } finally {
      // Evita dejar canales huérfanos en el client admin (sin socket real igual limpia el mapa).
      await supabase.removeChannel(channel);
    }
  } catch (error) {
    console.error(`[broadcastAdminEvent] ${topic} / ${event}:`, error);
    return false;
  }
}
