'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import { obtenerCategoriasMenu, crearCategoria, eliminarCategoria } from '../categoriasActions';
import type { CategoriaMenu } from '../types';

export function useCategorias(initial?: CategoriaMenu[]) {
  return useQuery({
    queryKey: queryKeys.categoriasMenu(),
    queryFn: () => obtenerCategoriasMenu(),
    initialData: initial,
  });
}

export function useCrearCategoria() {
  const queryClient = useQueryClient();
  const key = queryKeys.categoriasMenu();

  return useMutation({
    mutationFn: async (nombre: string) => {
      const res = await crearCategoria(nombre);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (nombre) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategoriaMenu[]>(key) ?? [];
      queryClient.setQueryData<CategoriaMenu[]>(key, [
        ...previous,
        { id: `temp-${crypto.randomUUID()}`, nombre },
      ]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al crear la categoría');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEliminarCategoria() {
  const queryClient = useQueryClient();
  const key = queryKeys.categoriasMenu();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await eliminarCategoria(id);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategoriaMenu[]>(key) ?? [];
      queryClient.setQueryData<CategoriaMenu[]>(
        key,
        previous.filter((c) => c.id !== id)
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar la categoría');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
