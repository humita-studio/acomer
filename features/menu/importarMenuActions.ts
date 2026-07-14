'use server';

import { and, eq, isNull } from 'drizzle-orm';
import {
  categorias,
  productos,
  productosPrecios,
} from '@/shared/db/schema';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath, revalidateTag } from 'next/cache';
import { normalizarVisualCategoria } from './categoriaVisual';
import type { FilaMenuCsv } from './importarCsv';

const MAX_FILAS = 300;

export type ImportarMenuResult =
  | {
      success: true;
      message: string;
      creados: number;
      categoriasNuevas: number;
    }
  | { success: false; message: string };

/**
 * Importa productos desde filas ya parseadas del CSV plantilla.
 * Crea categorías que no existan (match case-insensitive por nombre).
 */
export async function importarMenuFilasAction(
  filas: FilaMenuCsv[],
): Promise<ImportarMenuResult> {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canManageMenu')) {
    return { success: false, message: 'No tenés permiso para gestionar el menú' };
  }

  if (!Array.isArray(filas) || filas.length === 0) {
    return { success: false, message: 'No hay productos para importar.' };
  }
  if (filas.length > MAX_FILAS) {
    return {
      success: false,
      message: `Máximo ${MAX_FILAS} productos por importación. Dividí el archivo.`,
    };
  }

  // Sanitizar otra vez en server (no confiar en el cliente).
  const limpias = filas
    .map((f) => ({
      nombre: String(f.nombre ?? '').trim().slice(0, 120),
      descripcion: String(f.descripcion ?? '').trim().slice(0, 500),
      categoria: String(f.categoria ?? '').trim().slice(0, 80),
      precio: Number(f.precio),
      disponible: f.disponible !== false,
    }))
    .filter(
      (f) =>
        f.nombre.length > 0 &&
        f.categoria.length > 0 &&
        Number.isFinite(f.precio) &&
        f.precio > 0,
    );

  if (limpias.length === 0) {
    return { success: false, message: 'Ninguna fila es válida.' };
  }

  try {
    const result = await withTenant(claimsFromSession(session), async (db) => {
      return db.transaction(async (tx) => {
        const catsExistentes = await tx
          .select({
            id: categorias.id,
            nombre: categorias.nombre,
          })
          .from(categorias)
          .where(
            and(
              eq(categorias.restauranteId, session.restauranteId),
              isNull(categorias.deletedAt),
            ),
          );

        const catByKey = new Map(
          catsExistentes.map((c) => [c.nombre.trim().toLowerCase(), c.id]),
        );
        let categoriasNuevas = 0;

        const ensureCategoria = async (nombreCat: string): Promise<string> => {
          const key = nombreCat.trim().toLowerCase();
          const existing = catByKey.get(key);
          if (existing) return existing;

          const visual = normalizarVisualCategoria({});
          const [nueva] = await tx
            .insert(categorias)
            .values({
              restauranteId: session.restauranteId,
              nombre: nombreCat.trim(),
              color: visual.color,
              icono: visual.icono,
            })
            .returning({ id: categorias.id });

          catByKey.set(key, nueva.id);
          categoriasNuevas += 1;
          return nueva.id;
        };

        let creados = 0;
        for (const fila of limpias) {
          const categoriaId = await ensureCategoria(fila.categoria);
          const [nuevo] = await tx
            .insert(productos)
            .values({
              restauranteId: session.restauranteId,
              categoriaId,
              nombre: fila.nombre,
              descripcion: fila.descripcion || null,
              activo: fila.disponible,
              permiteAdicionales: false,
            })
            .returning({ id: productos.id });

          await tx.insert(productosPrecios).values({
            restauranteId: session.restauranteId,
            productoId: nuevo.id,
            precio: fila.precio.toString(),
            creadoPor: session.user.id,
          });
          creados += 1;
        }

        return { creados, categoriasNuevas };
      });
    });

    revalidatePath('/admin/menu');
    revalidateTag(`carta-${session.restauranteId}`, 'default');

    const partes = [
      `${result.creados} producto${result.creados === 1 ? '' : 's'} importado${result.creados === 1 ? '' : 's'}`,
    ];
    if (result.categoriasNuevas > 0) {
      partes.push(
        `${result.categoriasNuevas} categor${result.categoriasNuevas === 1 ? 'ía nueva' : 'ías nuevas'}`,
      );
    }

    return {
      success: true,
      message: partes.join(' · '),
      creados: result.creados,
      categoriasNuevas: result.categoriasNuevas,
    };
  } catch (error) {
    console.error('[importarMenuFilasAction]', error);
    return { success: false, message: 'No se pudo importar el menú. Probá de nuevo.' };
  }
}
