'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import {
  obtenerVariantesMenu,
  agregarVariante,
  editarPrecioVariante,
  eliminarVariante,
  marcarVarianteDefault,
} from '../variantesActions';
import type { Variante } from '../types';

/**
 * Variantes (presentaciones de elección única, precio fijo) del menú. Fuente de
 * verdad en TanStack Query; `initialVariantes` siembra la caché desde el server.
 */
export function useVariantes(initialVariantes?: Variante[]) {
  return useQuery({
    queryKey: queryKeys.variantesMenu(),
    queryFn: () => obtenerVariantesMenu(),
    initialData: initialVariantes,
  });
}

export function useAgregarVariante() {
  const queryClient = useQueryClient();
  const key = queryKeys.variantesMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; nombre: string; precio: number }) => {
      const res = await agregarVariante(vars.productoId, { nombre: vars.nombre, precio: vars.precio });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      const delProducto = previous.filter((v) => v.productoId === vars.productoId);
      const optimista: Variante = {
        productoId: vars.productoId,
        id: `temp-${crypto.randomUUID()}`,
        nombre: vars.nombre,
        precio: vars.precio,
        orden: delProducto.length,
        esDefault: delProducto.length === 0,
      };
      queryClient.setQueryData<Variante[]>(key, [...previous, optimista]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al agregar la variante');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEditarPrecioVariante() {
  const queryClient = useQueryClient();
  const key = queryKeys.variantesMenu();

  return useMutation({
    mutationFn: async (vars: { varianteId: string; nuevoPrecio: number }) => {
      const res = await editarPrecioVariante(vars.varianteId, vars.nuevoPrecio);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      queryClient.setQueryData<Variante[]>(
        key,
        previous.map((v) => (v.id === vars.varianteId ? { ...v, precio: vars.nuevoPrecio } : v))
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

export function useEliminarVariante() {
  const queryClient = useQueryClient();
  const key = queryKeys.variantesMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; varianteId: string }) => {
      const res = await eliminarVariante(vars.productoId, vars.varianteId);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      queryClient.setQueryData<Variante[]>(
        key,
        previous.filter((v) => v.id !== vars.varianteId)
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar la variante');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useMarcarVarianteDefault() {
  const queryClient = useQueryClient();
  const key = queryKeys.variantesMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; varianteId: string }) => {
      const res = await marcarVarianteDefault(vars.productoId, vars.varianteId);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      queryClient.setQueryData<Variante[]>(
        key,
        previous.map((v) =>
          v.productoId === vars.productoId ? { ...v, esDefault: v.id === vars.varianteId } : v
        )
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al actualizar la variante por defecto');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
