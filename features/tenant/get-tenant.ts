import { cache } from 'react';
import { db } from '@/shared/db';
import { restaurantes } from '@/shared/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Un local "opera" para el público si existe, no fue borrado (soft delete) y
 * está activo. Desactivarlo desde /platform lo saca de la web pública (carta,
 * pedidos, reservas, QR de mesa) sin borrar datos.
 */
function localOperativo(slug: string) {
  return and(
    eq(restaurantes.slug, slug.toLowerCase()),
    eq(restaurantes.activo, true),
    isNull(restaurantes.deletedAt),
  );
}

/**
 * Detalles completos del restaurante (sólo si está operativo). Cacheado por
 * request: layout (metadata), página y `getTenantBySlug` comparten la misma
 * lectura, así el subdominio se resuelve con una única query.
 */
export const getTenantDetails = cache(async (slug: string) => {
  try {
    const tenant = await db
      .select()
      .from(restaurantes)
      .where(localOperativo(slug))
      .limit(1);

    return tenant[0] ?? null;
  } catch (error) {
    console.error(`[getTenantDetails] Error fetching tenant details for slug "${slug}":`, error);
    return null;
  }
});

/**
 * Extrae el restaurant_id a partir del slug del subdominio.
 * Por ejemplo: "pizzeria" desde "pizzeria.acomer.com.ar"
 *
 * @returns El restaurant_id o null si no existe / no está activo
 */
export const getTenantBySlug = cache(async (slug: string): Promise<string | null> => {
  const tenant = await getTenantDetails(slug);
  return tenant?.id ?? null;
});

/**
 * Valida que un restaurante existe y está activo.
 */
export async function validateTenant(tenantId: string): Promise<boolean> {
  try {
    const tenant = await db
      .select({ id: restaurantes.id })
      .from(restaurantes)
      .where(
        and(
          eq(restaurantes.id, tenantId),
          eq(restaurantes.activo, true),
          isNull(restaurantes.deletedAt),
        ),
      )
      .limit(1);

    return !!tenant[0];
  } catch (error) {
    console.error(`[validateTenant] Error validating tenant:`, error);
    return false;
  }
}
