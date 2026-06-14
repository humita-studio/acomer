import { db } from '@/shared/db';
import { restaurantes } from '@/shared/db/schema';
import { eq, isNull } from 'drizzle-orm';

/**
 * Extrae el restaurant_id a partir del slug del subdominio.
 * Por ejemplo: "pizzeria" desde "pizzeria.acomer.com.ar"
 * 
 * @param slug - El slug del restaurante extraído del hostname
 * @returns El restaurant_id o null si no existe el restaurante
 */
export async function getTenantBySlug(slug: string): Promise<string | null> {
  try {
    const tenant = await db
      .select({ id: restaurantes.id })
      .from(restaurantes)
      .where(eq(restaurantes.slug, slug.toLowerCase()))
      .limit(1);

    return tenant[0]?.id ?? null;
  } catch (error) {
    console.error(`[getTenantBySlug] Error fetching tenant for slug "${slug}":`, error);
    return null;
  }
}

/**
 * Obtiene los detalles completos del restaurante.
 */
export async function getTenantDetails(slug: string) {
  try {
    const tenant = await db
      .select()
      .from(restaurantes)
      .where(eq(restaurantes.slug, slug.toLowerCase()))
      .limit(1);

    return tenant[0] ?? null;
  } catch (error) {
    console.error(`[getTenantDetails] Error fetching tenant details for slug "${slug}":`, error);
    return null;
  }
}

/**
 * Valida que un restaurante existe y está activo.
 */
export async function validateTenant(tenantId: string): Promise<boolean> {
  try {
    const tenant = await db
      .select({ id: restaurantes.id })
      .from(restaurantes)
      .where(eq(restaurantes.id, tenantId))
      .limit(1);

    return !!tenant[0];
  } catch (error) {
    console.error(`[validateTenant] Error validating tenant:`, error);
    return false;
  }
}
