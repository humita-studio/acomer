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
  /** Hay al menos un cobro aprobado en la sesión (ej. mostrador ya cobrado). */
  pagado: boolean;
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

export function labelEstadoCocina(estado: EstadoPedidoCocina): string {
  switch (estado) {
    case 'Pendiente':
      return 'Nuevo';
    case 'En Preparación':
      return 'En prep.';
    case 'Listo':
      return 'Listo';
    case 'Entregado':
      return 'Entregado';
    case 'Cancelado':
      return 'Cancelado';
    case 'Pagado':
      return 'Pagado';
    default:
      return estado;
  }
}
