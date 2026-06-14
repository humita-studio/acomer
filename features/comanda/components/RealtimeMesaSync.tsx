'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { useComandaStore, CartItem } from '../store';
import { obtenerBorrador } from '../borrador-actions';
import type { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeMesaSyncProps = {
  sesionMesaId: string;
  tenantId: string;
  initialItems: CartItem[];
};

export function RealtimeMesaSync({ sesionMesaId, tenantId, initialItems }: RealtimeMesaSyncProps) {
  const router = useRouter();
  const setItems = useComandaStore((state) => state.setItems);
  const setBroadcastFn = useComandaStore((state) => state._setBroadcastFn);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Refetch all borrador items from the server and sync to the store
  const refetchBorrador = useCallback(async () => {
    try {
      const items = await obtenerBorrador(sesionMesaId);
      setItems(
        items.map((item) => ({
          id: item.id,
          productoId: item.productoId,
          nombre: item.nombreProducto,
          precioUnitario: item.precioUnitario,
          cantidad: item.cantidad,
          modificadores: item.modificadores,
        }))
      );
    } catch (error) {
      console.error('[RealtimeMesaSync] Error refetching borrador:', error);
    }
  }, [sesionMesaId, setItems]);

  // Hydrate the store with initial items from server on mount
  useEffect(() => {
    setItems(initialItems);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Single channel for this mesa session — uses Broadcast for cart sync
    const channel = supabase.channel(`mesa_${sesionMesaId}`, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
      },
    });

    channelRef.current = channel;

    channel
      // PRIMARY: Listen for broadcast events from other devices
      .on('broadcast', { event: 'cart_changed' }, () => {
        console.log('📡 Broadcast recibido: cart_changed — refetching...');
        refetchBorrador();
      })
      // El mozo cargó productos al ticket desde el admin → refrescar la vista del comensal
      .on('broadcast', { event: 'ticket_actualizado' }, () => {
        router.refresh();
      })
      // SECONDARY: Also listen for pedido state changes via postgres_changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `sesion_mesa_id=eq.${sesionMesaId}`,
        },
        (payload) => {
          if (payload.new && payload.new.estado) {
            console.log(`Un pedido cambió a estado: ${payload.new.estado}`);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado al canal de la mesa (Broadcast + Realtime)');

          // Register the broadcast function in the store so components can use it
          setBroadcastFn(() => {
            channel.send({
              type: 'broadcast',
              event: 'cart_changed',
              payload: { t: Date.now() },
            });
          });
        }
      });

    return () => {
      setBroadcastFn(null);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [sesionMesaId, refetchBorrador, setBroadcastFn, router]);

  return null;
}
