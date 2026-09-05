'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { EVENTO_SUSCRIPTO, sendBroadcast, useBroadcast } from '@/shared/supabase/realtime';
import { queryKeys } from '@/shared/query/keys';
import { useComandaStore } from '../store';

type RealtimeMesaSyncProps = {
  sesionMesaId: string;
  tenantId: string;
};

/**
 * Sincroniza la pantalla del comensal con los demás dispositivos de la mesa y
 * con el panel: carrito compartido, ticket cargado por el mozo, pedido
 * confirmado, mesa cerrada o pagada.
 */
export function RealtimeMesaSync({ sesionMesaId }: RealtimeMesaSyncProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setBroadcastChange = useComandaStore((s) => s.setBroadcastChange);
  const topic = `mesa_${sesionMesaId}`;

  const invalidarBorrador = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.borrador(sesionMesaId) });

  useBroadcast(topic, {
    // Otro dispositivo cambió el carrito → refetchear el borrador.
    cart_changed: invalidarBorrador,
    // El mozo cargó productos al ticket desde el admin.
    ticket_actualizado: () => router.refresh(),
    // Otro dispositivo confirmó el pedido → vaciar borrador y actualizar pedidos.
    pedido_confirmado: () => {
      invalidarBorrador();
      router.refresh();
    },
    // La mesa fue liberada, cerrada o pagada.
    sesion_cerrada: () => router.refresh(),
    pago_completado: () => router.refresh(),
    // Tras (re)conectar (pestaña en background / red), sincronizar borrador.
    [EVENTO_SUSCRIPTO]: invalidarBorrador,
  });

  // Registrar la función con la que las mutaciones avisan a los otros dispositivos.
  useEffect(() => {
    setBroadcastChange(() => {
      void sendBroadcast(topic, 'cart_changed', { t: Date.now() });
    });
    return () => setBroadcastChange(null);
  }, [topic, setBroadcastChange]);

  return null;
}
