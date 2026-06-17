'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { obtenerCategoriasMenu, crearCategoria, eliminarCategoria } from './categorias-actions';
import {
  obtenerProductosMenu,
  crearProducto,
  modificarPrecioProducto,
  eliminarProducto,
} from './productos-actions';

export type CategoriaMenu = { id: string; nombre: string };

export type ProductoMenu = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  precio: string | number;
  permiteAdicionales?: boolean;
};

// ============================================================================
// Categorías
// ============================================================================

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
      alert(error instanceof Error ? error.message : 'Error al crear la categoría');
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

// ============================================================================
// Productos
// ============================================================================

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
  precio: number;
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
        precio: vars.precio,
        permiteAdicionales: false,
      };
      queryClient.setQueryData<ProductoMenu[]>(key, [...previous, optimista]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      alert(error instanceof Error ? error.message : 'Error al crear el producto');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
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
      alert(error instanceof Error ? error.message : 'Error al actualizar el precio');
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
      alert(error instanceof Error ? error.message : 'Error al eliminar el producto');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
