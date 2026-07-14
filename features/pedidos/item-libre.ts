/**
 * Helpers puros de ítem libre (sin DB).
 */

export type ItemLibreLike = {
  productoId: string | null;
  nombreLibre?: string;
  precioLibre?: number;
};

/** Un ítem libre no referencia un producto: trae nombre + precio propios. */
export function esItemLibre(i: ItemLibreLike): boolean {
  return !i.productoId && typeof i.nombreLibre === 'string' && i.nombreLibre.trim().length > 0;
}
