'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { queryKeys } from '@/shared/query/keys';
import { useComandaStore } from './store';
import type { CartItem, Modificador, AgregarItemVars } from '@/features/carta/cart';
import {
  obtenerBorrador,
  agregarItemBorrador,
  eliminarItemBorrador,
  actualizarCantidadBorrador,
  type ItemBorrador,
} from './borrador-actions';
import { enviarPedidoAction } from './enviar-pedido-actions';

function toCartItem(i: ItemBorrador): CartItem {
  return {
    id: i.id,
    productoId: i.productoId,
    varianteId: i.varianteId,
    nombre: i.nombreProducto,
    precioUnitario: i.precioUnitario,
    cantidad: i.cantidad,
    modificadores: i.modificadores,
  };
}

/** Mismo producto con el mismo set de modificadores (comparando por id). */
function sameMods(a: Modificador[], b: Modificador[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].map((m) => m.id).sort();
  const bs = [...b].map((m) => m.id).sort();
  return as.every((id, i) => id === bs[i]);
}

const notificarOtrosDispositivos = () => {
  useComandaStore.getState().broadcastChange?.();
};

/**
 * El borrador (carrito compartido) de una sesión de mesa. Fuente de verdad del
 * carrito. `initialItems` siembra la caché con los datos del Server Component.
 */
export function useBorrador(sesionMesaId: string, initialItems?: CartItem[]) {
  return useQuery({
    queryKey: queryKeys.borrador(sesionMesaId),
    queryFn: async () => (await obtenerBorrador(sesionMesaId)).map(toCartItem),
    initialData: initialItems,
  });
}

export function useAgregarItem(tenantId: string, sesionMesaId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.borrador(sesionMesaId);

  return useMutation({
    mutationFn: (vars: AgregarItemVars) => agregarItemBorrador(sesionMesaId, tenantId, vars),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CartItem[]>(key) ?? [];
      const same = previous.find(
        (e) =>
          e.productoId === vars.productoId &&
          (e.varianteId ?? null) === (vars.varianteId ?? null) &&
          sameMods(e.modificadores, vars.modificadores)
      );
      const next = same
        ? previous.map((e) =>
            e.id === same.id ? { ...e, cantidad: e.cantidad + vars.cantidad } : e
          )
        : [
            ...previous,
            {
              id: `temp-${crypto.randomUUID()}`,
              productoId: vars.productoId,
              varianteId: vars.varianteId ?? null,
              nombre: vars.nombreProducto,
              precioUnitario: vars.precioUnitario,
              cantidad: vars.cantidad,
              modificadores: vars.modificadores,
            },
          ];
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSuccess: notificarOtrosDispositivos,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEliminarItem(tenantId: string, sesionMesaId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.borrador(sesionMesaId);

  return useMutation({
    mutationFn: (itemId: string) => eliminarItemBorrador(itemId, tenantId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CartItem[]>(key) ?? [];
      queryClient.setQueryData(key, previous.filter((e) => e.id !== itemId));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSuccess: notificarOtrosDispositivos,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useActualizarCantidad(tenantId: string, sesionMesaId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.borrador(sesionMesaId);

  return useMutation({
    mutationFn: ({ itemId, nuevaCantidad }: { itemId: string; nuevaCantidad: number }) =>
      actualizarCantidadBorrador(itemId, tenantId, nuevaCantidad),
    onMutate: async ({ itemId, nuevaCantidad }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CartItem[]>(key) ?? [];
      queryClient.setQueryData(
        key,
        previous.map((e) => (e.id === itemId ? { ...e, cantidad: nuevaCantidad } : e))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSuccess: notificarOtrosDispositivos,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEnviarPedido(tenantId: string, sesionMesaId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => enviarPedidoAction(tenantId, sesionMesaId),
    onSuccess: (res) => {
      if (res.success) {
        // El borrador se vació en el server; reflejarlo y avisar a los demás.
        queryClient.setQueryData(queryKeys.borrador(sesionMesaId), []);
        notificarOtrosDispositivos();
        // pedidosConfirmados es prop del Server Component → refrescar.
        router.refresh();
      }
    },
  });
}
