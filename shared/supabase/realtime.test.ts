import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (msg: { event: string; payload: unknown }) => void;

/** Cliente Supabase falso: un canal por topic (como supabase-js), suscripción inmediata. */
function fakeSupabase() {
  const channels = new Map<string, FakeChannel>();
  const removed: string[] = [];
  class FakeChannel {
    topic: string;
    listeners: Listener[] = [];
    subscribed = false;
    sent: { event: string; payload: unknown }[] = [];
    constructor(topic: string) {
      this.topic = topic;
    }
    on(_type: string, _filter: unknown, cb: Listener) {
      this.listeners.push(cb);
      return this;
    }
    subscribe(cb?: (status: string) => void) {
      this.subscribed = true;
      cb?.('SUBSCRIBED');
      return this;
    }
    async send(msg: { event: string; payload: unknown }) {
      this.sent.push(msg);
      return 'ok';
    }
    async httpSend() {
      return { success: true };
    }
    emit(event: string, payload: unknown) {
      for (const l of this.listeners) l({ event, payload });
    }
  }
  const client = {
    channel(topic: string) {
      let c = channels.get(topic);
      if (!c) {
        c = new FakeChannel(topic);
        channels.set(topic, c);
      }
      return c;
    },
    async removeChannel(c: FakeChannel) {
      removed.push(c.topic);
      channels.delete(c.topic);
      return 'ok';
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
    realtime: { setAuth: async () => {} },
  };
  return { client, channels, removed };
}

const fake = fakeSupabase();
vi.mock('./browser', () => ({ createSupabaseBrowserClient: () => fake.client }));

import { EVENTO_SUSCRIPTO, _resetRealtimeForTests, sendBroadcast, subscribeBroadcast } from './realtime';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('subscribeBroadcast', () => {
  beforeEach(() => {
    _resetRealtimeForTests();
    fake.channels.clear();
    fake.removed.length = 0;
  });

  it('dos suscriptores del mismo topic comparten un solo canal y cada uno recibe sus eventos', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeBroadcast('admin_restaurant_x', { nuevo_pedido: a });
    const offB = subscribeBroadcast('admin_restaurant_x', { cuenta_solicitada: b });
    await tick();

    expect(fake.channels.size).toBe(1);
    const ch = fake.channels.get('admin_restaurant_x')!;
    ch.emit('nuevo_pedido', { sesionMesaId: '1' });
    ch.emit('cuenta_solicitada', { sesionMesaId: '2' });
    expect(a).toHaveBeenCalledWith({ sesionMesaId: '1' });
    expect(b).toHaveBeenCalledWith({ sesionMesaId: '2' });
    expect(a).toHaveBeenCalledTimes(1);

    offA();
    expect(fake.removed).toEqual([]); // sigue B
    ch.emit('nuevo_pedido', {});
    expect(a).toHaveBeenCalledTimes(1); // A ya no escucha
    offB();
    expect(fake.removed).toEqual(['admin_restaurant_x']); // se fue el último
  });

  it('el pseudo-evento de conexión llega al que se suma con el canal ya conectado', async () => {
    const primero = vi.fn();
    const segundo = vi.fn();
    subscribeBroadcast('mesa_s1', { [EVENTO_SUSCRIPTO]: primero });
    await tick();
    expect(primero).toHaveBeenCalledTimes(1);
    subscribeBroadcast('mesa_s1', { [EVENTO_SUSCRIPTO]: segundo });
    expect(segundo).toHaveBeenCalledTimes(1);
  });

  it('darse de baja dos veces no descuenta dos suscriptores', async () => {
    const off = subscribeBroadcast('mesa_s2', { x: () => {} });
    subscribeBroadcast('mesa_s2', { y: () => {} });
    await tick();
    off();
    off();
    expect(fake.removed).toEqual([]);
  });

  it('un handler que explota no corta a los demás', async () => {
    const ok = vi.fn();
    subscribeBroadcast('mesa_s3', {
      e: () => {
        throw new Error('boom');
      },
    });
    subscribeBroadcast('mesa_s3', { e: ok });
    await tick();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.channels.get('mesa_s3')!.emit('e', {});
    expect(ok).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sendBroadcast usa el socket del canal conectado', async () => {
    subscribeBroadcast('mesa_s4', { cart_changed: () => {} });
    await tick();
    const ok = await sendBroadcast('mesa_s4', 'cart_changed', { t: 1 });
    expect(ok).toBe(true);
    expect(fake.channels.get('mesa_s4')!.sent).toEqual([{ type: 'broadcast', event: 'cart_changed', payload: { t: 1 } }]);
  });
});
