/**
 * Puente entre los dos tableros de estado del pedido:
 * - Cocina (KDS): `pedidos.estado` → Pendiente | En Preparación | Listo | Entregado | …
 * - Delivery/takeaway: `datos_entrega.estado_entrega` → Recibido | EnPreparacion | Listo | EnCamino | …
 *
 * Ambos deben avanzar juntos en los flujos e2e online; el salón solo usa cocina.
 */

export type EstadoCocina =
  | 'Pendiente'
  | 'En Preparación'
  | 'Listo'
  | 'Entregado'
  | 'Pagado'
  | 'Cancelado';

export type EstadoEntrega =
  | 'Recibido'
  | 'EnPreparacion'
  | 'Listo'
  | 'EnCamino'
  | 'Entregado'
  | 'Cancelado';

/** Cocina → seguimiento del comensal / tablero de pedidos online. */
export function cocinaAEntrega(estado: EstadoCocina): EstadoEntrega | null {
  switch (estado) {
    case 'Pendiente':
      return 'Recibido';
    case 'En Preparación':
      return 'EnPreparacion';
    case 'Listo':
      return 'Listo';
    case 'Entregado':
      return 'Entregado';
    case 'Cancelado':
      return 'Cancelado';
    default:
      return null;
  }
}

/**
 * Delivery → KDS. `EnCamino` ya salió de cocina: se marca Entregado en el KDS
 * para que deje de aparecer en columnas activas.
 */
export function entregaACocina(estado: EstadoEntrega): EstadoCocina | null {
  switch (estado) {
    case 'Recibido':
      return 'Pendiente';
    case 'EnPreparacion':
      return 'En Preparación';
    case 'Listo':
      return 'Listo';
    case 'EnCamino':
    case 'Entregado':
      return 'Entregado';
    case 'Cancelado':
      return 'Cancelado';
    default:
      return null;
  }
}
