'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from './browser';

/**
 * Suscripciones Realtime del navegador, UN canal por topic.
 *
 * supabase-js devuelve el MISMO RealtimeChannel para dos `channel(topic)` con el
 * mismo nombre. Antes cada componente hacía su propio `channel().on().subscribe()`
 * y `removeChannel()` al desmontar: la campana (layout), el plano, cocina y
 * cobros compartían `admin_restaurant_<tenant>` sin saberlo, y al salir de
 * /admin/mesas el plano le cortaba la suscripción a la campana hasta recargar.
 *
 * Acá el canal se crea una vez, cada suscriptor registra sus handlers por
 * evento y el canal se cierra recién cuando se va el último.
 *
 * Los canales son SIEMPRE privados: Supabase aplica las políticas de
 * `realtime.messages` (migración 0032, aplicada). El staff solo puede unirse a
 * `admin_restaurant_<su local>`; `mesa_<sesion>` queda abierto porque el id
 * de sesión es el secreto. Los broadcasts del servidor usan la secret key.
 */

export type BroadcastPayload = Record<string, unknown>;
export type BroadcastHandler = (payload: BroadcastPayload) => void;
export type BroadcastHandlers = Record<string, BroadcastHandler>;

/** Pseudo-evento: se dispara cada vez que el canal (re)conecta. Sirve para resincronizar. */
export const EVENTO_SUSCRIPTO = '$subscribed';

type Entry = {
  channel: RealtimeChannel;
  listeners: Map<string, Set<BroadcastHandler>>;
  suscriptores: number;
  conectado: boolean;
};

const entries = new Map<string, Entry>();

function despachar(entry: Entry, event: string, payload: BroadcastPayload) {
  const fns = entry.listeners.get(event);
  if (!fns) return;
  for (const fn of Array.from(fns)) {
    try {
      fn(payload);
    } catch (error) {
      console.error(`[realtime] handler de ${event} falló:`, error);
    }
  }
}

function crearEntry(topic: string): Entry {
  const supabase = createSupabaseBrowserClient();
  const channel = supabase.channel(topic, {
    config: { private: true, broadcast: { self: false } },
  });
  const entry: Entry = { channel, listeners: new Map(), suscriptores: 0, conectado: false };
  // Registrar ANTES de conectar: el join se cancela si todos se fueron mientras tanto.
  entries.set(topic, entry);

  channel.on('broadcast', { event: '*' }, (msg: { event?: string; payload?: unknown }) => {
    const payload =
      msg.payload && typeof msg.payload === 'object' ? (msg.payload as BroadcastPayload) : {};
    despachar(entry, String(msg.event ?? ''), payload);
  });

  void (async () => {
    // El canal privado se autoriza con el JWT del usuario: asegurarlo antes del join.
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
    } catch {
      // sin sesión (comensal): el JWT anon alcanza para los canales mesa_*
    }
    // Todos se desuscribieron antes de que llegáramos a conectar.
    if (entries.get(topic) !== entry) return;
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        entry.conectado = true;
        despachar(entry, EVENTO_SUSCRIPTO, {});
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        entry.conectado = false;
        console.warn(`[realtime] ${topic}:`, status, err);
      } else {
        entry.conectado = false;
      }
    });
  })();

  return entry;
}

/**
 * Registra handlers por evento en el canal del topic. Devuelve la función para
 * darse de baja; el canal se cierra cuando se va el último suscriptor.
 */
export function subscribeBroadcast(topic: string, handlers: BroadcastHandlers): () => void {
  const actual = entries.get(topic) ?? crearEntry(topic);
  actual.suscriptores += 1;

  for (const [event, fn] of Object.entries(handlers)) {
    let set = actual.listeners.get(event);
    if (!set) {
      set = new Set();
      actual.listeners.set(event, set);
    }
    set.add(fn);
  }
  // El que llega con el canal ya conectado también quiere su "resincronizar".
  if (actual.conectado && handlers[EVENTO_SUSCRIPTO]) handlers[EVENTO_SUSCRIPTO]({});

  let activo = true;
  return () => {
    if (!activo) return;
    activo = false;
    for (const [event, fn] of Object.entries(handlers)) {
      actual.listeners.get(event)?.delete(fn);
    }
    actual.suscriptores -= 1;
    if (actual.suscriptores <= 0 && entries.get(topic) === actual) {
      entries.delete(topic);
      void createSupabaseBrowserClient().removeChannel(actual.channel);
    }
  };
}

/**
 * Broadcast desde el navegador (p. ej. "cambió el carrito" hacia los otros
 * comensales de la mesa). Usa el socket si el canal está conectado; si no, REST.
 */
export async function sendBroadcast(
  topic: string,
  event: string,
  payload: BroadcastPayload,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const entry = entries.get(topic);
  try {
    if (entry?.conectado) {
      const res = await entry.channel.send({ type: 'broadcast', event, payload });
      return res === 'ok';
    }
    // `channel(topic)` devuelve el existente si hay uno a medio conectar: no removerlo.
    const channel = supabase.channel(topic, { config: { private: true } });
    try {
      await channel.httpSend(event, payload);
      return true;
    } finally {
      if (!entry) await supabase.removeChannel(channel);
    }
  } catch (error) {
    console.warn(`[realtime] no se pudo enviar ${event} a ${topic}:`, error);
    return false;
  }
}

/**
 * Hook: escucha eventos broadcast de un topic mientras el componente esté
 * montado. Los handlers pueden cerrar sobre estado de React (se lee siempre la
 * última versión); el conjunto de eventos debe ser estable por componente.
 * `topic` null/undefined = no escuchar.
 */
export function useBroadcast(topic: string | null | undefined, handlers: BroadcastHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  const eventos = Object.keys(handlers).join('|');

  useEffect(() => {
    if (!topic) return;
    const proxy: BroadcastHandlers = {};
    for (const event of eventos.split('|')) {
      if (!event) continue;
      proxy[event] = (payload) => ref.current[event]?.(payload);
    }
    return subscribeBroadcast(topic, proxy);
  }, [topic, eventos]);
}

/** Solo tests. */
export function _resetRealtimeForTests(): void {
  entries.clear();
}
