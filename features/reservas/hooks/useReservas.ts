'use client';

import { useBroadcast } from '@/shared/supabase/realtime';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import type { PlanoData } from '@/features/mesas/plano-data';
import {
  cambiarEstadoReservaAction,
  sentarReservaAction,
  asignarMesaReservaAction,
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

/** Invalida el mes cuando entra una reserva nueva o alguien la cambia desde otra pestaña. */
export function useReservasRealtime(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.reservasMes(tenantId, mesKey) });
  useBroadcast(`admin_restaurant_${tenantId}`, {
    reserva_nueva: invalidar,
    reserva_actualizada: invalidar,
  });
}

type ReservasSnapshot = { previous?: Reserva[] };

/**
 * Update optimista de una reserva en la lista del mes: la tarjeta cambia al
 * toque (confirmar, sentar, asignar mesa) y se revierte si el server falla.
 * `cancelQueries` evita que un refetch en vuelo (realtime, poll) pise el estado
 * optimista con datos viejos.
 */
async function patchReservaOptimista(
  queryClient: QueryClient,
  key: readonly unknown[],
  id: string,
  patch: Partial<Reserva>,
): Promise<ReservasSnapshot> {
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<Reserva[]>(key);
  queryClient.setQueryData<Reserva[]>(key, (old = []) =>
    old.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  );
  return { previous };
}

function revertirReservas(
  queryClient: QueryClient,
  key: readonly unknown[],
  ctx?: ReservasSnapshot,
) {
  if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
}

/** Etiqueta de la mesa desde el plano ya cacheado (si está), para el optimista. */
function etiquetaMesaCacheada(
  queryClient: QueryClient,
  tenantId: string,
  mesaId: string | null | undefined,
): Partial<Reserva> {
  if (mesaId === undefined) return {};
  if (mesaId === null) return { mesaId: null, mesaIdentificador: null, mesaCapacidad: null };
  const mesa = queryClient
    .getQueryData<PlanoData>(queryKeys.plano(tenantId))
    ?.mesas.find((m) => m.id === mesaId);
  return mesa
    ? { mesaId, mesaIdentificador: mesa.identificador, mesaCapacidad: mesa.capacidad }
    : { mesaId };
}

export function useCambiarEstadoReserva(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.reservasMes(tenantId, mesKey);
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      cambiarEstadoReservaAction(id, estado as never),
    onMutate: ({ id, estado }) => patchReservaOptimista(queryClient, key, id, { estado }),
    onSuccess: (res, vars, ctx) => {
      if (!res.success) {
        revertirReservas(queryClient, key, ctx);
        toast.error(res.message ?? 'No se pudo actualizar la reserva');
      } else {
        const msg: Record<string, string> = {
          Confirmada: 'Reserva confirmada',
          Cumplida: 'Reserva marcada como cumplida',
          Cancelada: 'Reserva cancelada',
          NoShow: 'Marcada como no-show',
        };
        toast.success(msg[vars.estado] ?? 'Reserva actualizada');
      }
    },
    onError: (_e, _vars, ctx) => {
      revertirReservas(queryClient, key, ctx);
      toast.error('No se pudo actualizar la reserva');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useSentarReserva(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.reservasMes(tenantId, mesKey);
  return useMutation({
    mutationFn: ({ id, mesaId }: { id: string; mesaId?: string | null }) =>
      sentarReservaAction(id, mesaId),
    onMutate: ({ id, mesaId }) =>
      patchReservaOptimista(queryClient, key, id, {
        estado: 'Sentada',
        ...etiquetaMesaCacheada(queryClient, tenantId, mesaId ?? undefined),
      }),
    onSuccess: (res, _vars, ctx) => {
      if (res.success) {
        toast.success('Mesa sentada', {
          description: 'La mesa quedó abierta en el salón. Podés cargar el pedido desde Mesas.',
        });
      } else {
        revertirReservas(queryClient, key, ctx);
        toast.error(res.message ?? 'No se pudo sentar la reserva');
      }
    },
    onError: (_e, _vars, ctx) => {
      revertirReservas(queryClient, key, ctx);
      toast.error('No se pudo sentar la reserva');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      // El plano de mesas también cambia al sentar.
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    },
  });
}

export function useAsignarMesaReserva(tenantId: string, mesKey: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.reservasMes(tenantId, mesKey);
  return useMutation({
    mutationFn: ({ id, mesaId }: { id: string; mesaId: string | null }) =>
      asignarMesaReservaAction(id, mesaId),
    onMutate: ({ id, mesaId }) =>
      patchReservaOptimista(
        queryClient,
        key,
        id,
        etiquetaMesaCacheada(queryClient, tenantId, mesaId),
      ),
    onSuccess: (res, _vars, ctx) => {
      if (res.success) {
        toast.success(res.message ?? 'Mesa actualizada');
      } else {
        revertirReservas(queryClient, key, ctx);
        toast.error(res.message ?? 'No se pudo asignar la mesa');
      }
    },
    onError: (_e, _vars, ctx) => {
      revertirReservas(queryClient, key, ctx);
      toast.error('No se pudo asignar la mesa');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['mesas-disponibles'] });
    },
  });
}

type NuevaReservaInput = {
  nombreContacto: string;
  telefono: string;
  inicioISO: string;
  personas: number;
  duracionMin?: number;
  mesaId?: string | null;
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

/** Mesas libres para un horario/cantidad (diálogo "Asignar mesa"). On-demand. */
export function useMesasDisponibles(params: {
  inicioISO: string;
  personas: number;
  duracionMin: number;
  excluirReservaId?: string | null;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.mesasDisponibles(
      params.inicioISO,
      params.personas,
      params.duracionMin,
      params.excluirReservaId ?? null,
    ),
    queryFn: async () => {
      const res = await getMesasDisponiblesAction(
        params.inicioISO,
        params.personas,
        params.duracionMin,
        params.excluirReservaId,
      );
      return res.success ? res.mesas : [];
    },
    enabled: params.enabled,
    staleTime: 15_000,
  });
}
