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
      // Cambios de estado de pedidos (cocina, etc.)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `sesion_mesa_id=eq.${sesionMesaId}`,
        },
        (payload) => {
          const estado = (payload.new as { estado?: string } | null)?.estado;
          if (estado) {
            console.log(`Un pedido cambió a estado: ${estado}`);
          }
        }
      )
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
        }
      });

    return () => {
      setBroadcastChange(null);
      supabase.removeChannel(channel);
    };
  }, [sesionMesaId, queryClient, router, setBroadcastChange]);

  return null;
}
