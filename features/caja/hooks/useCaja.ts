'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPeso } from '@/shared/lib/format';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import {
  abrirCajaAction,
  cerrarCajaAction,
  getCajaActualAction,
  getDetalleCierreAction,
  getHistorialCajasAction,
  registrarMovimientoAction,
} from '../cajaActions';
import type { CajaActual, CajaCerrada, TipoMovimiento } from '../types';

/** Sesión de caja abierta. Se refresca sola para mantener el efectivo esperado al día. */
export function useCajaActual(tenantId: string, initial: CajaActual | null) {
  return useQuery({
    queryKey: queryKeys.caja(tenantId),
    queryFn: () => getCajaActualAction(),
    initialData: initial,
    refetchInterval: 20 * 1000,
  });
}

export function useHistorialCajas(tenantId: string, initial: CajaCerrada[]) {
  return useQuery({
    queryKey: queryKeys.cajaHistorial(tenantId),
    queryFn: () => getHistorialCajasAction(),
    initialData: initial,
  });
}

/** Desglose de un cierre. Solo se consulta cuando hay una sesión seleccionada. */
export function useDetalleCierre(sesionCajaId: string | null) {
  return useQuery({
    queryKey: queryKeys.cajaDetalle(sesionCajaId ?? ''),
    queryFn: () => getDetalleCierreAction(sesionCajaId as string),
    enabled: !!sesionCajaId,
  });
}

/**
 * Refresca el efectivo esperado cuando hay cobros o movimientos en el local
 * (otra pestaña / otro cajero).
 */
export function useCajaRealtime(tenantId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const invalidar = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cajaHistorial(tenantId) });
    };
    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'cuenta_solicitada' }, invalidar)
      .on('broadcast', { event: 'mesa_pagada' }, invalidar)
      .on('broadcast', { event: 'pago_parcial' }, invalidar)
      .on('broadcast', { event: 'caja_actualizada' }, invalidar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}

function useInvalidarCaja(tenantId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cajaHistorial(tenantId) });
  };
}

export function useAbrirCaja(tenantId: string) {
  const invalidar = useInvalidarCaja(tenantId);
  return useMutation({
    mutationFn: async (montoInicial: number) => {
      const res = await abrirCajaAction(montoInicial);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: () => {
      invalidar();
      toast.success('Caja abierta', {
        description: 'Ya podés cobrar ventas de mostrador y efectivo de mesas.',
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir la caja'),
  });
}

export function useRegistrarMovimiento(tenantId: string) {
  const invalidar = useInvalidarCaja(tenantId);
  return useMutation({
    mutationFn: async (vars: {
      cajaId: string;
      tipo: TipoMovimiento;
      monto: number;
      concepto: string;
    }) => {
      const res = await registrarMovimientoAction(vars.cajaId, vars.tipo, vars.monto, vars.concepto);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (_res, vars) => {
      invalidar();
      const tipoLabel =
        vars.tipo === 'ingreso' ? 'Ingreso' : vars.tipo === 'egreso' ? 'Egreso' : 'Retiro';
      toast.success(`${tipoLabel} registrado`, {
        description: formatPeso(vars.monto),
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar el movimiento'),
  });
}

export function useCerrarCaja(tenantId: string) {
  const invalidar = useInvalidarCaja(tenantId);
  return useMutation({
    mutationFn: async (vars: { cajaId: string; montoContado: number; notas: string }) => {
      const res = await cerrarCajaAction(vars.cajaId, vars.montoContado, vars.notas);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (res) => {
      invalidar();
      const dif = res.diferencia;
      toast.success('Caja cerrada', {
        description:
          dif === undefined || dif === null
            ? undefined
            : dif === 0
              ? 'Sin diferencia de efectivo'
              : dif > 0
                ? `Sobrante de ${formatPeso(dif)}`
                : `Faltante de ${formatPeso(Math.abs(dif))}`,
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'No se pudo cerrar la caja'),
  });
}
