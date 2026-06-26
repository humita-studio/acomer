'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import {
  cambiarEstadoReservaAction,
  sentarReservaAction,
  getReservasDelDiaAction,
  getProximaReservaAction,
  getReservaAnteriorAction,
  crearReservaAdminAction,
  getMesasDisponiblesAction,
} from '../reservasActions';
import type { Reserva } from '../types';

/** Reservas del mes visible. Siembra la caché con lo que ya trajo el Server Component. */
export function useReservasMes(params: {
  tenantId: string;
  mesKey: string;
  desdeISO: string;
  hastaISO: string;
  initial: Reserva[];
}) {
  return useQuery({
    queryKey: queryKeys.reservasMes(params.tenantId, params.mesKey),
    queryFn: async () => {
      const res = await getReservasDelDiaAction(params.desdeISO, params.hastaISO);
      return res.success ? (res.reservas as Reserva[]) : [];
    },
    initialData: params.initial,
  });
}

/**
 * Inicio de la próxima reserva vigente a partir de un instante. Se usa para
 * ofrecer "ir al próximo día con reservas" cuando el mes visible no tiene
 * ninguna después del día elegido (puede caer en un mes futuro). On-demand.
 */
export function useProximaReserva(params: { tenantId: string; desdeISO: string; enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.proximaReserva(params.tenantId, params.desdeISO),
    queryFn: async () => {
      const res = await getProximaReservaAction(params.desdeISO);
      return res.success ? res.inicio : null;
    },
    enabled: params.enabled,
    staleTime: 60_000,
  });
}

/**
 * Inicio de la reserva vigente más reciente anterior a un instante. Espejo de
 * useProximaReserva para ofrecer "ir al día anterior con reservas" cuando el mes
 * visible no tiene ninguna antes del día elegido. On-demand.
 */
export function useReservaAnterior(params: { tenantId: string; hastaISO: string; enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.reservaAnterior(params.tenantId, params.hastaISO),
    queryFn: async () => {
      const res = await getReservaAnteriorAction(params.hastaISO);
      return res.success ? res.inicio : null;
    },
    enabled: params.enabled,
    staleTime: 60_000,
  });
}

/** Invalida el mes cuando entra una reserva nueva. */
export function useReservasRealtime(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'reserva_nueva' }, () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.reservasMes(tenantId, mesKey) })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, mesKey, queryClient]);
}

export function useCambiarEstadoReserva(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      cambiarEstadoReservaAction(id, estado as never),
    onSuccess: (res) => {
      if (!res.success) toast.error(res.message ?? 'No se pudo actualizar la reserva');
      queryClient.invalidateQueries({ queryKey: queryKeys.reservasMes(tenantId, mesKey) });
    },
  });
}

export function useSentarReserva(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mesaId }: { id: string; mesaId: string }) => sentarReservaAction(id, mesaId),
    onSuccess: (res) => {
      if (res.success) toast.success('Reserva sentada');
      else toast.error(res.message ?? 'No se pudo sentar la reserva');
      queryClient.invalidateQueries({ queryKey: queryKeys.reservasMes(tenantId, mesKey) });
    },
  });
}

type NuevaReservaInput = {
  nombreContacto: string;
  telefono: string;
  inicioISO: string;
  personas: number;
  duracionMin?: number;
  notas?: string;
};

export function useCrearReservaAdmin(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: NuevaReservaInput) => {
      const res = await crearReservaAdminAction(datos);
      if (!res.success) throw new Error(res.message ?? 'No se pudo crear la reserva');
      return res;
    },
    onSuccess: () => {
      toast.success('Reserva creada');
      queryClient.invalidateQueries({ queryKey: queryKeys.reservasMes(tenantId, mesKey) });
    },
  });
}

/** Mesas libres para un horario/cantidad (popover "Asignar mesa"). On-demand. */
export function useMesasDisponibles(params: {
  inicioISO: string;
  personas: number;
  duracionMin: number;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.mesasDisponibles(params.inicioISO, params.personas, params.duracionMin),
    queryFn: async () => {
      const res = await getMesasDisponiblesAction(params.inicioISO, params.personas, params.duracionMin);
      return res.success ? res.mesas : [];
    },
    enabled: params.enabled,
    staleTime: 30_000,
  });
}
