'use server';

import { db } from '@/shared/db';
import { itemsBorradorMesa } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';

export type ModificadorBorrador = {
  id: string;
  nombre: string;
  precioExtra: number;
};

export type ItemBorrador = {
  id: string;
  productoId: string;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
  modificadores: ModificadorBorrador[];
};

export async function obtenerBorrador(sesionMesaId: string): Promise<ItemBorrador[]> {
  const items = await db
    .select()
    .from(itemsBorradorMesa)
    .where(eq(itemsBorradorMesa.sesionMesaId, sesionMesaId))
    .orderBy(itemsBorradorMesa.createdAt);

  return items.map((item) => ({
    id: item.id,
    productoId: item.productoId,
    nombreProducto: item.nombreProducto,
    precioUnitario: parseFloat(item.precioUnitario?.toString() || '0'),
    cantidad: item.cantidad,
    modificadores: (item.modificadores as ModificadorBorrador[]) || [],
  }));
}

export async function agregarItemBorrador(
  sesionMesaId: string,
  tenantId: string,
  item: {
    productoId: string;
    nombreProducto: string;
    precioUnitario: number;
    cantidad: number;
    modificadores: ModificadorBorrador[];
  }
) {
  try {
    const existentes = await db
      .select()
      .from(itemsBorradorMesa)
      .where(
        and(
          eq(itemsBorradorMesa.sesionMesaId, sesionMesaId),
          eq(itemsBorradorMesa.restauranteId, tenantId),
          eq(itemsBorradorMesa.productoId, item.productoId)
        )
      );

    const sameItem = existentes.find(e => {
      const dbMods = (e.modificadores as ModificadorBorrador[]) || [];
      if (dbMods.length !== item.modificadores.length) return false;
      
      const dbModIds = [...dbMods].map(m => m.id).sort();
      const newModIds = [...item.modificadores].map(m => m.id).sort();
      
      return dbModIds.every((id, idx) => id === newModIds[idx]);
    });

    if (sameItem) {
      await db
        .update(itemsBorradorMesa)
        .set({ cantidad: sameItem.cantidad + item.cantidad })
        .where(eq(itemsBorradorMesa.id, sameItem.id));
      return { success: true };
    }

    await db.insert(itemsBorradorMesa).values({
      restauranteId: tenantId,
      sesionMesaId,
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      precioUnitario: item.precioUnitario.toString(),
      cantidad: item.cantidad,
      modificadores: item.modificadores,
    });

    return { success: true };
  } catch (error) {
    console.error('[agregarItemBorrador]', error);
    return { success: false, message: 'Error al agregar item' };
  }
}

export async function eliminarItemBorrador(itemId: string, tenantId: string) {
  try {
    await db
      .delete(itemsBorradorMesa)
      .where(
        and(
          eq(itemsBorradorMesa.id, itemId),
          eq(itemsBorradorMesa.restauranteId, tenantId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('[eliminarItemBorrador]', error);
    return { success: false, message: 'Error al eliminar item' };
  }
}

export async function actualizarCantidadBorrador(
  itemId: string,
  tenantId: string,
  nuevaCantidad: number
) {
  try {
    if (nuevaCantidad < 1) {
      return eliminarItemBorrador(itemId, tenantId);
    }

    await db
      .update(itemsBorradorMesa)
      .set({ cantidad: nuevaCantidad })
      .where(
        and(
          eq(itemsBorradorMesa.id, itemId),
          eq(itemsBorradorMesa.restauranteId, tenantId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('[actualizarCantidadBorrador]', error);
    return { success: false, message: 'Error al actualizar cantidad' };
  }
}
