import { unstable_cache } from 'next/cache';
import { withPublicTenant } from '@/shared/db/secure-wrapper';
import {
  categorias,
  productos,
  productosPrecios,
  modificadores,
  modificadoresPrecios,
  productoModificadoresDisponibles,
  productoVariantes,
  productoVariantesPrecios,
} from '@/shared/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import type { CategoriaMenu, ProductoMenu } from './types';

/**
 * Función interna que consulta la DB.
 */
async function fetchCarta(
  tenantId: string
): Promise<{ categorias: CategoriaMenu[]; productos: ProductoMenu[] }> {
  const [cats, prods, modsDisponibles, variantesRows] = await withPublicTenant(tenantId, (db) => Promise.all([
    db
      .select({
        id: categorias.id,
        nombre: categorias.nombre,
        color: categorias.color,
        icono: categorias.icono,
      })
      .from(categorias)
      .where(
        and(
          eq(categorias.restauranteId, tenantId),
          eq(categorias.activo, true),
          isNull(categorias.deletedAt)
        )
      )
      .orderBy(asc(categorias.createdAt)),

    db
      .select({
        id: productos.id,
        categoriaId: productos.categoriaId,
        nombre: productos.nombre,
        descripcion: productos.descripcion,
        imagenUrl: productos.imagenUrl,
        alergenos: productos.alergenos,
        permiteAdicionales: productos.permiteAdicionales,
        precio: productosPrecios.precio,
      })
      .from(productos)
      .leftJoin(
        productosPrecios,
        and(eq(productos.id, productosPrecios.productoId), isNull(productosPrecios.vigentaHsta))
      )
      .where(
        and(
          eq(productos.restauranteId, tenantId),
          eq(productos.activo, true),
          isNull(productos.deletedAt)
        )
      ),

    db
      .select({
        productoId: productoModificadoresDisponibles.productoId,
        id: modificadores.id,
        nombre: modificadores.nombre,
        precioExtra: modificadoresPrecios.precioExtra,
      })
      .from(productoModificadoresDisponibles)
      .innerJoin(modificadores, eq(productoModificadoresDisponibles.modificadorId, modificadores.id))
      .innerJoin(
        modificadoresPrecios,
        and(
          eq(modificadores.id, modificadoresPrecios.modificadorId),
          isNull(modificadoresPrecios.vigentaHsta)
        )
      )
      .where(
        and(
          eq(modificadores.restauranteId, tenantId),
          eq(modificadores.disponible, true),
          isNull(modificadores.deletedAt)
        )
      ),

    db
      .select({
        productoId: productoVariantes.productoId,
        id: productoVariantes.id,
        nombre: productoVariantes.nombre,
        precio: productoVariantesPrecios.precio,
        esDefault: productoVariantes.esDefault,
      })
      .from(productoVariantes)
      .leftJoin(
        productoVariantesPrecios,
        and(
          eq(productoVariantes.id, productoVariantesPrecios.varianteId),
          isNull(productoVariantesPrecios.vigentaHsta)
        )
      )
      .where(
        and(
          eq(productoVariantes.restauranteId, tenantId),
          eq(productoVariantes.activo, true),
          isNull(productoVariantes.deletedAt)
        )
      )
      .orderBy(asc(productoVariantes.orden)),
  ]));

  const productosMenu: ProductoMenu[] = prods.map((p) => {
    const variantes = variantesRows
      .filter((v) => v.productoId === p.id)
      .map((v) => ({
        id: v.id,
        nombre: v.nombre,
        precio: parseFloat(v.precio?.toString() || '0'),
        esDefault: v.esDefault,
      }));

    const basePrecio = parseFloat(p.precio?.toString() || '0');
    const precio = variantes.length > 0 ? Math.min(...variantes.map((v) => v.precio)) : basePrecio;

    return {
      id: p.id,
      categoriaId: p.categoriaId,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio,
      imagenUrl: p.imagenUrl?.trim() || null,
      alergenos: Array.isArray(p.alergenos) ? p.alergenos.filter(Boolean) : [],
      permiteAdicionales: p.permiteAdicionales,
      modificadores: modsDisponibles
        .filter((m) => m.productoId === p.id)
        .map((m) => ({
          id: m.id,
          nombre: m.nombre,
          precioExtra: parseFloat(m.precioExtra?.toString() || '0'),
        })),
      variantes,
    };
  });

  return { categorias: cats, productos: productosMenu };
}

/**
 * Carta activa de un restaurante cacheada.
 * Se invalida automáticamente cuando el admin actualiza la carta
 * usando revalidateTag(`carta-${tenantId}`).
 */
export async function obtenerCarta(tenantId: string) {
  return unstable_cache(
    async () => fetchCarta(tenantId),
    ['carta', tenantId],
    { tags: [`carta-${tenantId}`] }
  )();
}

