/**
 * Validación cliente del checkout de pedidos online (mensajes en español).
 */

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
  tipo: 'takeaway' | 'delivery';
  direccion?: string;
  itemsCount: number;
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
  }
  return null;
}
