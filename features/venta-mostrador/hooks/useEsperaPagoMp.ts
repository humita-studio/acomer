'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { estadoVentaMostradorAction } from '../ventaMostradorActions';
import type { MpData } from '../types';

/**
 * Espera la confirmación del pago de Mercado Pago. Dos vías:
 *  1. Realtime: el webhook emite `pago_completado` al aprobarse (vía principal).
 *  2. Poll de respaldo cada 3s contra nuestra DB (en local el webhook no llega).
 * `resueltoRef` garantiza que se resuelva una sola vez (gana el que dispare primero).
 */
export function useEsperaPagoMp(
  mp: Pick<MpData, 'sesionId' | 'transactionId'>,
  onAprobado: () => void,
  onError: (msg: string) => void,
) {
  const resueltoRef = useRef(false);

  useEffect(() => {
    let activo = true;

    const resolver = (fn: () => void) => {
      if (resueltoRef.current || !activo) return;
      resueltoRef.current = true;
      fn();
    };

    // 1. Realtime: el webhook emite `pago_completado` al aprobarse.
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`mesa_${mp.sesionId}`);
    channel.on('broadcast', { event: 'pago_completado' }, () => resolver(onAprobado)).subscribe();

    // 2. Polling de respaldo (en local el webhook puede no llegar).
    const interval = setInterval(async () => {
      const { estado } = await estadoVentaMostradorAction(mp.transactionId);
      if (estado === 'Aprobado') resolver(onAprobado);
      else if (estado === 'Rechazado' || estado === 'Cancelado') {
        resolver(() => onError('El pago fue rechazado o cancelado.'));
      }
    }, 3000);

    return () => {
      activo = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [mp.sesionId, mp.transactionId, onAprobado, onError]);
}
