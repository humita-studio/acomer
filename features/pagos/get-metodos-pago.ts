'use server';

import { db } from '@/shared/db';

export type MetodoPago = {
  id: string;
  nombre: string;
  tipo: 'digital' | 'presencial';
  icono: string; // emoji or icon name
};

/**
 * Retorna los medios de pago disponibles para un restaurante.
 * Siempre incluye efectivo y tarjeta física.
 * Agrega Mercado Pago si tiene OAuth configurado con access_token.
 */
export async function getMetodosPago(restauranteId: string): Promise<MetodoPago[]> {
  const metodos: MetodoPago[] = [];

  // 1. Medios digitales según configuración
  const config = await db.query.configuracionPagos.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.restauranteId, restauranteId),
      eq(t.activo, true),
    ),
  });

  if (config) {
    const creds = config.credenciales as { access_token?: string } | null;

    if (
      (config.proveedor === 'mercado_pago' || config.proveedor === 'mercado_pago_oauth') &&
      creds?.access_token
    ) {
      metodos.push({
        id: 'mercado_pago',
        nombre: 'Mercado Pago',
        tipo: 'digital',
        icono: '💳',
      });
    }
  }

  // 2. Medios presenciales (siempre disponibles)
  metodos.push({
    id: 'tarjeta_fisica',
    nombre: 'Tarjeta',
    tipo: 'presencial',
    icono: '💳',
  });

  metodos.push({
    id: 'efectivo',
    nombre: 'Efectivo',
    tipo: 'presencial',
    icono: '💵',
  });

  return metodos;
}
