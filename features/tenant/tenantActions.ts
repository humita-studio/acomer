'use server';

import { db } from '@/shared/db';
import { restaurantes } from '@/shared/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/features/auth/session';
import { normalizarSubdominio, validarSubdominio } from './subdominio';

export type ResultadoSubdominio = { success: boolean; message: string; slug?: string };

/**
 * Admin: cambia el subdominio (slug) del restaurante en sesión. Valida formato,
 * reservados y unicidad. OJO: cambia la URL pública del local y los QR de mesa
 * ya impresos dejan de funcionar.
 */
export async function actualizarSubdominioAction(raw: string): Promise<ResultadoSubdominio> {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
      return { success: false, message: 'No autorizado' };
    }

    const slug = normalizarSubdominio(raw);
    const error = validarSubdominio(slug);
    if (error) return { success: false, message: error };

    if (slug === session.slugRestaurante) {
      return { success: true, message: 'El subdominio ya era ese', slug };
    }

    // ¿Lo está usando otro restaurante?
    const [tomado] = await db
      .select({ id: restaurantes.id })
      .from(restaurantes)
      .where(and(eq(restaurantes.slug, slug), ne(restaurantes.id, session.restauranteId)))
      .limit(1);
    if (tomado) return { success: false, message: 'Ese subdominio ya está en uso.' };

    await db.update(restaurantes).set({ slug }).where(eq(restaurantes.id, session.restauranteId));

    revalidatePath('/admin/configuracion');
    revalidatePath('/admin/mesas'); // los QR de mesa usan el slug
    revalidatePath(`/${slug}`);
    return { success: true, message: 'Subdominio actualizado', slug };
  } catch (error) {
    console.error('[actualizarSubdominioAction]', error);
    return { success: false, message: 'No se pudo actualizar el subdominio' };
  }
}

/**
 * Admin: cambia el nombre del restaurante.
 */
export async function actualizarNombreRestauranteAction(nombreRaw: string): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
      return { success: false, message: 'No autorizado' };
    }

    const nombre = nombreRaw.trim();
    if (!nombre) {
      return { success: false, message: 'El nombre no puede estar vacío' };
    }

    if (nombre === session.nombreRestaurante) {
      return { success: true, message: 'El nombre ya era ese' };
    }

    await db.update(restaurantes).set({ nombre }).where(eq(restaurantes.id, session.restauranteId));

    revalidatePath('/admin/configuracion');
    revalidatePath(`/${session.slugRestaurante}`);
    return { success: true, message: 'Nombre actualizado' };
  } catch (error) {
    console.error('[actualizarNombreRestauranteAction]', error);
    return { success: false, message: 'No se pudo actualizar el nombre' };
  }
}
