/**
 * Catálogo de planes SaaS (source of truth del producto).
 * Precios en ARS enteros. "a_medida" no se cobra online.
 * El cobro está siempre activo: prueba de TRIAL_DAYS, gracia de GRACE_DAYS y
 * bloqueo del panel al vencer (ver access.ts). Los locales que no pagan se
 * marcan "exempt" desde /platform.
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

/** Duración del trial al registrarse (3 meses). */
export const TRIAL_DAYS = 90;
/** Días de gracia tras vencer trial/período antes del hard gate. */
export const GRACE_DAYS = 3;
/** Duración del período al aprobar un pago (días). */
export const PERIOD_DAYS = 30;

/**
 * Features del producto completo. No hay gate por plan: todos usan todo; los
 * planes se diferencian por acompañamiento (A medida) y precio.
 */
const FEATURES_TODO = [
  'Carta digital con QR',
  'Mesas ilimitadas',
  'Cocina y cobros (efectivo / MP)',
  'Reservas y pedidos online',
  'Promociones y reportes',
  'Roles de staff',
] as const;

export const PLANES_SAAS: Record<PlanId, PlanDef> = {
  basico: {
    id: 'basico',
    nombre: 'Básico',
    // Precios de referencia para cuando se habilite cobro.
    precioMensual: 14_900,
    maxMesas: null,
    descripcion: 'Todo el producto, para arrancar.',
    features: [...FEATURES_TODO],
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precioMensual: 29_900,
    maxMesas: null,
    descripcion: 'Todo el producto, con prioridad de soporte.',
    features: [...FEATURES_TODO],
    destacado: true,
  },
  a_medida: {
    id: 'a_medida',
    nombre: 'A medida',
    precioMensual: null,
    maxMesas: null,
    descripcion: 'Setup asistido y acompañamiento.',
    features: [
      ...FEATURES_TODO,
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
