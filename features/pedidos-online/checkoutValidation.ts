/**
 * Validación cliente del checkout de pedidos online (mensajes en español).
 */

import {
  cumplePedidoMinimo,
  type DeliveryConfig,
  type ModoPedido,
} from './deliveryConfig';
import { isLatLng, puntoEnZona, type LatLng } from './zonaMapa';

export function normalizarTelefono(raw: string): string {
  return raw.replace(/[^\d+]/g, '').trim();
}

/** Teléfono AR razonable: 8–15 dígitos (con o sin +54 / 15). */
export function telefonoValido(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export function validarCheckoutCliente(input: {
  nombre: string;
  telefono: string;
  tipo: ModoPedido;
  direccion?: string;
  itemsCount: number;
  /** Subtotal del carrito con descuentos (sin envío). */
  subtotalCarrito?: number;
  /** Config de delivery del local (pedido mínimo + zona). */
  deliveryConfig?: Pick<DeliveryConfig, 'pedidoMinimo' | 'zonaPoligono'>;
  /** Pin del cliente en el mapa. */
  pin?: LatLng | null;
}): string | null {
  if (input.itemsCount <= 0) return 'Tu carrito está vacío. Sumá algo del menú.';
  if (input.nombre.trim().length < 2) return 'Ingresá tu nombre.';
  if (input.nombre.trim().length > 120) return 'El nombre es demasiado largo.';
  if (!telefonoValido(input.telefono)) {
    return 'Ingresá un teléfono válido (ej. 11 2345 6789).';
  }
  if (input.tipo === 'delivery') {
    const dir = (input.direccion ?? '').trim();
    if (dir.length < 5) return 'Ingresá la dirección de entrega completa.';
    if (dir.length > 300) return 'La dirección es demasiado larga.';
    if (
      input.deliveryConfig &&
      input.subtotalCarrito != null &&
      !cumplePedidoMinimo(input.deliveryConfig, 'delivery', input.subtotalCarrito)
    ) {
      const min = Number(input.deliveryConfig.pedidoMinimo) || 0;
      return `El pedido mínimo para envío es $${min.toLocaleString('es-AR')}.`;
    }
    const poly = input.deliveryConfig?.zonaPoligono ?? null;
    if (poly) {
      if (!input.pin || !isLatLng(input.pin)) {
        return 'Marcá tu ubicación en el mapa, dentro de la zona de entrega.';
      }
      if (!puntoEnZona(poly, input.pin)) {
        return 'Tu ubicación está fuera de la zona de entrega.';
      }
    }
  }
  return null;
}
