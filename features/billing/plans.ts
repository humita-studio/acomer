/**
 * Catálogo de planes SaaS (source of truth del producto).
 * Precios en ARS enteros. "a_medida" no se cobra online.
 */

export type PlanId = 'basico' | 'pro' | 'a_medida';

export type PlanDef = {
  id: PlanId;
  nombre: string;
  precioMensual: number | null; // null = consultar
  maxMesas: number | null; // null = ilimitado
  descripcion: string;
  features: string[];
  destacado?: boolean;
};

export const TRIAL_DAYS = 14;
/** Días de gracia tras vencer trial/período antes del hard gate. */
export const GRACE_DAYS = 3;
/** Duración del período al aprobar un pago (días). */
export const PERIOD_DAYS = 30;

export const PLANES_SAAS: Record<PlanId, PlanDef> = {
  basico: {
    id: 'basico',
    nombre: 'Básico',
    precioMensual: 14_900,
    maxMesas: 15,
    descripcion: 'Para arrancar con lo esencial.',
    features: [
      'Carta digital con QR',
      'Hasta 15 mesas',
      'Cocina y cobros',
      'Reportes del día',
    ],
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precioMensual: 29_900,
    maxMesas: null,
    descripcion: 'El más elegido por restaurantes en marcha.',
    features: [
      'Todo lo de Básico',
      'Mesas ilimitadas',
      'Reservas + pedidos online',
      'Cobros con Mercado Pago',
      'Promociones y reportes',
      'Roles de staff',
    ],
    destacado: true,
  },
  a_medida: {
    id: 'a_medida',
    nombre: 'A medida',
    precioMensual: null,
    maxMesas: null,
    descripcion: 'Setup asistido y acompañamiento.',
    features: [
      'Todo lo de Pro',
      'Onboarding dedicado',
      'Soporte prioritario',
      'Prioridad en el roadmap',
    ],
  },
};

export function planDef(id: string | null | undefined): PlanDef {
  if (id && id in PLANES_SAAS) return PLANES_SAAS[id as PlanId];
  return PLANES_SAAS.pro;
}

export function isPlanId(v: string): v is PlanId {
  return v === 'basico' || v === 'pro' || v === 'a_medida';
}

export function trialEndsAtFromNow(from = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
