'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import {
  obtenerCategoriasMenu,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  type CategoriaInput,
} from '../categoriasActions';
import type { CategoriaMenu } from '../types';
import { normalizarVisualCategoria } from '../categoriaVisual';

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
    mutationFn: async (input: CategoriaInput) => {
      const res = await crearCategoria(input);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategoriaMenu[]>(key) ?? [];
      const visual = normalizarVisualCategoria(input);
      queryClient.setQueryData<CategoriaMenu[]>(key, [
        ...previous,
        {
          id: `temp-${crypto.randomUUID()}`,
          nombre: input.nombre.trim(),
          color: visual.color,
          icono: visual.icono,
        },
      ]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      alert(error instanceof Error ? error.message : 'Error al crear la categoría');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEditarCategoria() {
  const queryClient = useQueryClient();
  const key = queryKeys.categoriasMenu();

  return useMutation({
    mutationFn: async ({ id, ...input }: CategoriaInput & { id: string }) => {
      const res = await editarCategoria(id, input);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async ({ id, ...input }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategoriaMenu[]>(key) ?? [];
      const visual = normalizarVisualCategoria(input);
      queryClient.setQueryData<CategoriaMenu[]>(
        key,
        previous.map((c) =>
          c.id === id
            ? {
                ...c,
                nombre: input.nombre.trim(),
                color: visual.color,
                icono: visual.icono,
              }
            : c
        )
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      alert(error instanceof Error ? error.message : 'Error al actualizar la categoría');
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
      alert(error instanceof Error ? error.message : 'Error al eliminar la categoría');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
