'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { useComandaStore } from '../store';

type RealtimeMesaSyncProps = {
  sesionMesaId: string;
  tenantId: string;
};

export function RealtimeMesaSync({ sesionMesaId }: RealtimeMesaSyncProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setBroadcastChange = useComandaStore((s) => s.setBroadcastChange);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Single channel for this mesa session — uses Broadcast for cart sync
    const channel = supabase.channel(`mesa_${sesionMesaId}`, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
      },
    });

    channel
      // Otro dispositivo cambió el carrito → invalidar para refetchear.
      .on('broadcast', { event: 'cart_changed' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.borrador(sesionMesaId) });
      })
      // El mozo cargó productos al ticket desde el admin → refrescar la vista del comensal
      .on('broadcast', { event: 'ticket_actualizado' }, () => {
        router.refresh();
      })
      // Otro dispositivo confirmó el pedido → vaciar borrador y actualizar vista de pedidos
      .on('broadcast', { event: 'pedido_confirmado' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.borrador(sesionMesaId) });
        router.refresh();
      })
      // La mesa fue liberada o cerrada → refrescar vista del comensal
      .on('broadcast', { event: 'sesion_cerrada' }, () => {
        router.refresh();
      })
      // La mesa se pagó (webhook MP o cajero) → refrescar (la sesión se cierra).
      .on('broadcast', { event: 'pago_completado' }, () => {
        router.refresh();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Registrar la función de broadcast para que las mutaciones avisen a otros dispositivos.
          setBroadcastChange(() => {
            channel.send({
              type: 'broadcast',
              event: 'cart_changed',
              payload: { t: Date.now() },
            });
          });
          // Tras reconectar (pestaña en background / red), sincronizar borrador.
          queryClient.invalidateQueries({ queryKey: queryKeys.borrador(sesionMesaId) });
        }
      });

    return () => {
      setBroadcastChange(null);
      supabase.removeChannel(channel);
    };
  }, [sesionMesaId, queryClient, router, setBroadcastChange]);

  return null;
}
