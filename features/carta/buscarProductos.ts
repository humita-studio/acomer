import Fuse from 'fuse.js';

/** Producto mínimo que el buscador necesita. */
export type ProductoBuscable = {
  nombre: string;
  descripcion?: string | null;
};

/** Minúsculas + sin tildes, para que "cafe" encuentre "Café". */
export function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Filtra el menú por texto del comensal.
 *
 * - Corto (1–2 chars): solo substring en el nombre (nada de fuzzy).
 * - Más largo: primero substring por palabras (todas tienen que aparecer en
 *   nombre o descripción). Si no hay hits, fuzzy estricto solo sobre el nombre
 *   para tolerar typos leves — no inventa matches random.
 */
export function filtrarProductosPorBusqueda<T extends ProductoBuscable>(
  productos: T[],
  queryRaw: string,
): T[] {
  const query = queryRaw.trim();
  if (!query) return productos;

  const q = normalizarBusqueda(query);

  if (q.length < 3) {
    return productos.filter((p) => normalizarBusqueda(p.nombre).includes(q));
  }

  const words = q.split(/\s+/).filter(Boolean);

  const porPalabras = productos.filter((p) => {
    const haystack = normalizarBusqueda(
      `${p.nombre} ${p.descripcion ?? ''}`,
    );
    return words.every((w) => haystack.includes(w));
  });

  if (porPalabras.length > 0) {
    // Nombre primero; si empatan, el match más al inicio del nombre gana.
    return [...porPalabras].sort((a, b) => {
      const an = normalizarBusqueda(a.nombre);
      const bn = normalizarBusqueda(b.nombre);
      const aInName = words.every((w) => an.includes(w)) ? 0 : 1;
      const bInName = words.every((w) => bn.includes(w)) ? 0 : 1;
      if (aInName !== bInName) return aInName - bInName;
      const aIdx = an.indexOf(words[0]!);
      const bIdx = bn.indexOf(words[0]!);
      return (aIdx < 0 ? 999 : aIdx) - (bIdx < 0 ? 999 : bIdx);
    });
  }

  // Sin coincidencia literal: typos leves solo en el nombre.
  // Score bajo = más parecido. Cortamos en ~0.4 para no devolver basura.
  const fuse = new Fuse(productos, {
    keys: [{ name: 'nombre', weight: 1 }],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: Math.min(3, q.length),
    includeScore: true,
    // Buscar sobre nombre normalizado (tildes / mayúsculas).
    getFn: (obj, path) => {
      const value = Fuse.config.getFn(obj, path);
      if (Array.isArray(value)) return value.map((v) => normalizarBusqueda(String(v)));
      if (value == null) return '';
      return normalizarBusqueda(String(value));
    },
  });

  return fuse
    .search(q)
    .filter((r) => (r.score ?? 1) <= 0.4)
    .map((r) => r.item);
}
