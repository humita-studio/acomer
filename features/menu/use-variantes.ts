'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import {
  obtenerVariantesMenu,
  agregarVarianteAPlato,
  editarPrecioVariante,
  eliminarVarianteDePlato,
} from './modificadores-actions';

export type Variante = {
  productoId: string;
  id: string;
  nombre: string;
  precio: string | number;
};

/**
 * Variantes (adicionales) del menú. Fuente de verdad en TanStack Query.
 * `initialVariantes` siembra la caché con lo que ya trajo el Server Component.
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
    mutationFn: async (vars: { productoId: string; nombre: string; precioExtra: number }) => {
      const res = await agregarVarianteAPlato(vars.productoId, {
        nombre: vars.nombre,
        precioExtra: vars.precioExtra,
      });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      const optimista: Variante = {
        productoId: vars.productoId,
        id: `temp-${crypto.randomUUID()}`,
        nombre: vars.nombre,
        precio: vars.precioExtra,
      };
      queryClient.setQueryData<Variante[]>(key, [...previous, optimista]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      alert(error instanceof Error ? error.message : 'Error al agregar la variante');
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
    mutationFn: async (vars: { modificadorId: string; nuevoPrecio: number }) => {
      const res = await editarPrecioVariante(vars.modificadorId, vars.nuevoPrecio);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      queryClient.setQueryData<Variante[]>(
        key,
        previous.map((v) => (v.id === vars.modificadorId ? { ...v, precio: vars.nuevoPrecio } : v))
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      alert(error instanceof Error ? error.message : 'Error al actualizar el precio');
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
    mutationFn: async (vars: { productoId: string; modificadorId: string }) => {
      const res = await eliminarVarianteDePlato(vars.productoId, vars.modificadorId);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Variante[]>(key) ?? [];
      queryClient.setQueryData<Variante[]>(
        key,
        previous.filter((v) => v.id !== vars.modificadorId)
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      alert(error instanceof Error ? error.message : 'Error al eliminar la variante');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
