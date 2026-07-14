// Tipos y defaults de la config de pedidos online (takeaway/delivery). Módulo
// plano (sin 'use server' ni `db`) para importarse tanto desde server actions
// como desde componentes cliente sin arrastrar dependencias de servidor.

import type { ZonaPoligono } from './zonaMapa';

export type { ZonaPoligono } from './zonaMapa';

export type ModoPedido = 'takeaway' | 'delivery';

// Hasta cuándo el cliente puede seguir agregando productos a un pedido ya
// confirmado: 'no' = no permite; 'preparacion' = solo mientras está "Recibido"
// (antes de que la cocina empiece); 'listo' = hasta que el pedido esté listo.
export type AgregadosHasta = 'no' | 'preparacion' | 'listo';

export type DeliveryConfig = {
  activo: boolean; // pedidos online habilitados
  modo: 'ambos' | 'takeaway' | 'delivery'; // modalidades que ofrece el local
  agregadosHasta: AgregadosHasta;
  /** Zona de cobertura en texto libre (barrios, radio, referencias). */
  zonaEntrega: string;
  /** Polígono dibujado en el mapa (GeoJSON). null = sin zona dibujada. */
  zonaPoligono: ZonaPoligono | null;
  /** Costo fijo de envío en pesos. 0 = gratis. */
  costoEnvio: number;
  /** Mínimo del carrito (sin envío) para delivery. 0 = sin mínimo. */
  pedidoMinimo: number;
  /** Minutos estimados de entrega/listo. null = no mostrar. */
  tiempoEstimadoMin: number | null;
};

/** Defaults cuando el restaurante todavía no tiene fila de config. */
export const DELIVERY_CONFIG_DEFAULT: DeliveryConfig = {
  // Off hasta que el dueño lo active (evita /pedir vacío el día 1).
  activo: false,
  modo: 'ambos',
  agregadosHasta: 'preparacion',
  zonaEntrega: '',
  zonaPoligono: null,
  costoEnvio: 0,
  pedidoMinimo: 0,
  tiempoEstimadoMin: null,
};

/** Modalidades concretas habilitadas según la config. */
export function modosPermitidos(config: DeliveryConfig): ModoPedido[] {
  if (config.modo === 'takeaway') return ['takeaway'];
  if (config.modo === 'delivery') return ['delivery'];
  return ['takeaway', 'delivery'];
}

/** ¿La config ofrece envío a domicilio? */
export function ofreceDelivery(config: Pick<DeliveryConfig, 'modo'>): boolean {
  return config.modo === 'ambos' || config.modo === 'delivery';
}

/**
 * ¿El subtotal del carrito (ya con descuentos de promo, sin envío) alcanza el
 * pedido mínimo para delivery? Takeaway no aplica mínimo.
 */
export function cumplePedidoMinimo(
  config: Pick<DeliveryConfig, 'pedidoMinimo'>,
  tipo: ModoPedido,
  subtotalCarrito: number,
): boolean {
  if (tipo !== 'delivery') return true;
  const min = Number(config.pedidoMinimo) || 0;
  if (min <= 0) return true;
  return subtotalCarrito + 1e-9 >= min;
}

/** Costo de envío efectivo según tipo de pedido. */
export function costoEnvioEfectivo(
  config: Pick<DeliveryConfig, 'costoEnvio'>,
  tipo: ModoPedido,
): number {
  if (tipo !== 'delivery') return 0;
  const n = Number(config.costoEnvio);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
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
