'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import {
  obtenerAdicionalesMenu,
  agregarAdicionalAPlato,
  editarPrecioAdicional,
  eliminarAdicionalDePlato,
} from '../modificadoresActions';
import type { Adicional } from '../types';

/**
 * Adicionales (extras aditivos) del menú. Fuente de verdad en TanStack Query.
 * `initialAdicionales` siembra la caché con lo que ya trajo el Server Component.
 */
export function useAdicionales(initialAdicionales?: Adicional[]) {
  return useQuery({
    queryKey: queryKeys.adicionalesMenu(),
    queryFn: () => obtenerAdicionalesMenu(),
    initialData: initialAdicionales,
  });
}

export function useAgregarAdicional() {
  const queryClient = useQueryClient();
  const key = queryKeys.adicionalesMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; nombre: string; precioExtra: number }) => {
      const res = await agregarAdicionalAPlato(vars.productoId, {
        nombre: vars.nombre,
        precioExtra: vars.precioExtra,
      });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Adicional[]>(key) ?? [];
      const optimista: Adicional = {
        productoId: vars.productoId,
        id: `temp-${crypto.randomUUID()}`,
        nombre: vars.nombre,
        precio: vars.precioExtra,
      };
      queryClient.setQueryData<Adicional[]>(key, [...previous, optimista]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al agregar el adicional');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEditarPrecioAdicional() {
  const queryClient = useQueryClient();
  const key = queryKeys.adicionalesMenu();

  return useMutation({
    mutationFn: async (vars: { modificadorId: string; nuevoPrecio: number }) => {
      const res = await editarPrecioAdicional(vars.modificadorId, vars.nuevoPrecio);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Adicional[]>(key) ?? [];
      queryClient.setQueryData<Adicional[]>(
        key,
        previous.map((a) => (a.id === vars.modificadorId ? { ...a, precio: vars.nuevoPrecio } : a))
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al actualizar el precio');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEliminarAdicional() {
  const queryClient = useQueryClient();
  const key = queryKeys.adicionalesMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; modificadorId: string }) => {
      const res = await eliminarAdicionalDePlato(vars.productoId, vars.modificadorId);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Adicional[]>(key) ?? [];
      queryClient.setQueryData<Adicional[]>(
        key,
        previous.filter((a) => a.id !== vars.modificadorId)
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar el adicional');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
