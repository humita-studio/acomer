// Catálogo / carta: modelo de los productos y categorías que se muestran al
// armar un pedido. Lo consumen todas las superficies (mesa, online, mostrador).

export type ModificadorMenu = {
  id: string;
  nombre: string;
  precioExtra: number;
};

/** Presentación de un plato (elección única, precio fijo). P. ej. Napolitana. */
export type VarianteMenu = {
  id: string;
  nombre: string;
  precio: number;
  esDefault: boolean;
};

export type ProductoMenu = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  // Precio para la tarjeta: el base, o el de la variante más barata si tiene variantes.
  precio: number;
  permiteAdicionales: boolean;
  modificadores: ModificadorMenu[];
  variantes: VarianteMenu[];
};

export type CategoriaMenu = {
  id: string;
  nombre: string;
};
