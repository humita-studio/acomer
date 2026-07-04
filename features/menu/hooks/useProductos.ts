'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import {
  obtenerProductosMenu,
  crearProducto,
  editarProducto,
  modificarPrecioProducto,
  cambiarDisponibilidadProducto,
  duplicarProducto,
  eliminarProducto,
} from '../productosActions';
import type { ProductoMenu } from '../types';

export function useProductos(initial?: ProductoMenu[]) {
  return useQuery({
    queryKey: queryKeys.productosMenu(),
    queryFn: () => obtenerProductosMenu(),
    initialData: initial,
  });
}

export type CrearProductoVars = {
  categoriaId: string;
  nombre: string;
  descripcion?: string;
  precio?: number;
  disponible?: boolean;
  adicionales?: { nombre: string; precioExtra: number }[];
  variantes?: { nombre: string; precio: number }[];
};

export function useCrearProducto() {
  const queryClient = useQueryClient();
  const key = queryKeys.productosMenu();

  return useMutation({
    mutationFn: async (vars: CrearProductoVars) => {
      const res = await crearProducto(vars);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProductoMenu[]>(key) ?? [];
      const optimista: ProductoMenu = {
        id: `temp-${crypto.randomUUID()}`,
        categoriaId: vars.categoriaId,
        nombre: vars.nombre,
        descripcion: vars.descripcion || null,
        precio: vars.precio ?? null,
        permiteAdicionales: (vars.adicionales?.length ?? 0) > 0,
        activo: vars.disponible ?? true,
      };
      queryClient.setQueryData<ProductoMenu[]>(key, [...previous, optimista]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al crear el producto');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      // Adicionales y variantes se crean junto con el producto: refrescamos sus cachés.
      queryClient.invalidateQueries({ queryKey: queryKeys.adicionalesMenu() });
      queryClient.invalidateQueries({ queryKey: queryKeys.variantesMenu() });
    },
  });
}

export type EditarProductoVars = {
  productoId: string;
  nombre: string;
  descripcion?: string;
  categoriaId?: string;
};

export function useEditarProducto() {
  const queryClient = useQueryClient();
  const key = queryKeys.productosMenu();

  return useMutation({
    mutationFn: async (vars: EditarProductoVars) => {
      const res = await editarProducto(vars.productoId, {
        nombre: vars.nombre,
        descripcion: vars.descripcion,
        categoriaId: vars.categoriaId,
      });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProductoMenu[]>(key) ?? [];
      queryClient.setQueryData<ProductoMenu[]>(
        key,
        previous.map((p) =>
          p.id === vars.productoId
            ? {
                ...p,
                nombre: vars.nombre,
                descripcion: vars.descripcion || null,
                categoriaId: vars.categoriaId ?? p.categoriaId,
              }
            : p
        )
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al actualizar el producto');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCambiarDisponibilidad() {
  const queryClient = useQueryClient();
  const key = queryKeys.productosMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; disponible: boolean }) => {
      const res = await cambiarDisponibilidadProducto(vars.productoId, vars.disponible);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProductoMenu[]>(key) ?? [];
      queryClient.setQueryData<ProductoMenu[]>(
        key,
        previous.map((p) => (p.id === vars.productoId ? { ...p, activo: vars.disponible } : p))
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al cambiar la disponibilidad');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDuplicarProducto() {
  const queryClient = useQueryClient();
  const key = queryKeys.productosMenu();

  return useMutation({
    mutationFn: async (productoId: string) => {
      const res = await duplicarProducto(productoId);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: queryKeys.adicionalesMenu() });
    },
  });
}

export function useModificarPrecioProducto() {
  const queryClient = useQueryClient();
  const key = queryKeys.productosMenu();

  return useMutation({
    mutationFn: async (vars: { productoId: string; nuevoPrecio: number }) => {
      const res = await modificarPrecioProducto(vars.productoId, vars.nuevoPrecio);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProductoMenu[]>(key) ?? [];
      queryClient.setQueryData<ProductoMenu[]>(
        key,
        previous.map((p) => (p.id === vars.productoId ? { ...p, precio: vars.nuevoPrecio } : p))
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

export function useEliminarProducto() {
  const queryClient = useQueryClient();
  const key = queryKeys.productosMenu();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await eliminarProducto(id);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProductoMenu[]>(key) ?? [];
      queryClient.setQueryData<ProductoMenu[]>(
        key,
        previous.filter((p) => p.id !== id)
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar el producto');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
