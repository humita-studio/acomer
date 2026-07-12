// Modelo de dominio del menú. Fuente única de tipos compartidos entre
// hooks, actions y componentes de la feature.

export type CategoriaMenu = {
  id: string;
  nombre: string;
  /** Clave de paleta (features/menu/categoriaVisual). */
  color: string;
  /** Nombre de icono Lucide (features/menu/categoriaVisual). */
  icono: string;
};

export type ProductoMenu = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  // null para productos "con variantes" (el precio vive en cada variante).
  precio: string | number | null;
  permiteAdicionales?: boolean;
  activo: boolean;
};

/**
 * Adicional: extra aditivo y opcional de un plato (ex-"variante"). Suma su
 * `precio` (extra) al precio base. Se puede elegir más de uno. P. ej. "Extra queso".
 */
export type Adicional = {
  productoId: string;
  id: string;
  nombre: string;
  precio: string | number;
};

/**
 * Variante: presentación de un plato con precio fijo y elección única/obligatoria.
 * `precio` es absoluto (no se suma a una base). P. ej. Milanesa → Napolitana.
 */
export type Variante = {
  productoId: string;
  id: string;
  nombre: string;
  precio: string | number;
  orden: number;
  esDefault: boolean;
};
