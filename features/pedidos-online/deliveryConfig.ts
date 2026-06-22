// Tipos y defaults de la config de pedidos online (takeaway/delivery). Módulo
// plano (sin 'use server' ni `db`) para importarse tanto desde server actions
// como desde componentes cliente sin arrastrar dependencias de servidor.

export type ModoPedido = 'takeaway' | 'delivery';

// Hasta cuándo el cliente puede seguir agregando productos a un pedido ya
// confirmado: 'no' = no permite; 'preparacion' = solo mientras está "Recibido"
// (antes de que la cocina empiece); 'listo' = hasta que el pedido esté listo.
export type AgregadosHasta = 'no' | 'preparacion' | 'listo';

export type DeliveryConfig = {
  activo: boolean; // pedidos online habilitados
  modo: 'ambos' | 'takeaway' | 'delivery'; // modalidades que ofrece el local
  agregadosHasta: AgregadosHasta;
};

/** Defaults cuando el restaurante todavía no tiene fila de config. */
export const DELIVERY_CONFIG_DEFAULT: DeliveryConfig = {
  activo: true,
  modo: 'ambos',
  agregadosHasta: 'preparacion',
};

/** Modalidades concretas habilitadas según la config. */
export function modosPermitidos(config: DeliveryConfig): ModoPedido[] {
  if (config.modo === 'takeaway') return ['takeaway'];
  if (config.modo === 'delivery') return ['delivery'];
  return ['takeaway', 'delivery'];
}

// Orden del flujo de entrega, para comparar estados.
const ORDEN_ESTADOS = ['Recibido', 'EnPreparacion', 'Listo', 'EnCamino', 'Entregado'] as const;

/**
 * ¿Puede el cliente agregar más productos a un pedido ya confirmado, dado el
 * estado de entrega actual y la config del local? Se permite mientras el estado
 * sea estrictamente anterior al corte elegido por el dueño.
 */
export function puedeAgregar(config: DeliveryConfig, estadoEntrega: string): boolean {
  if (config.agregadosHasta === 'no') return false;
  const idx = ORDEN_ESTADOS.indexOf(estadoEntrega as (typeof ORDEN_ESTADOS)[number]);
  if (idx < 0) return false; // Cancelado / desconocido
  const corte = config.agregadosHasta === 'preparacion' ? 'EnPreparacion' : 'Listo';
  return idx < ORDEN_ESTADOS.indexOf(corte);
}
