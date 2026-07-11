export type EstadoPedidoCocina = 'Pendiente' | 'En Preparación' | 'Listo' | 'Entregado' | 'Pagado' | 'Cancelado';

export type ComandaItemCocina = {
  id: string;
  nombre: string;
  cantidad: number;
  modificadores: string[];
  notas?: string | null;
};

export type PedidoCocina = {
  id: string;
  estado: EstadoPedidoCocina;
  total: number;
  notas: string | null;
  createdAt: string;
  /** Identificador de mesa o canal externo. */
  etiquetaOrigen: string;
  tipoSesion: string;
  items: ComandaItemCocina[];
};

export const COLUMNAS_KDS: {
  estado: EstadoPedidoCocina;
  label: string;
  description: string;
}[] = [
  { estado: 'Pendiente', label: 'Nuevos', description: 'Por aceptar' },
  { estado: 'En Preparación', label: 'En prep.', description: 'Cocinando' },
  { estado: 'Listo', label: 'Listos', description: 'Para entregar' },
];
