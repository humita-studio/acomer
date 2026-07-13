/**
 * Checklist de primer día del local.
 * Define los pasos fijos; el estado `done` lo calcula el server action.
 */

export type OnboardingStepId =
  | 'menu'
  | 'mesas'
  | 'pagos'
  | 'caja'
  | 'staff'
  | 'landing';

export type OnboardingStepStatus = {
  id: OnboardingStepId;
  done: boolean;
  /** Contexto corto para la UI, ej. "3 productos". */
  detalle?: string;
};

export type OnboardingStatus = {
  steps: OnboardingStepStatus[];
  /** Pasos obligatorios completados. */
  hechos: number;
  /** Total de pasos obligatorios. */
  total: number;
  /** true si los pasos required están listos. */
  listo: boolean;
  /** Slug del local (para link a la página pública). */
  slug: string;
};

export type OnboardingStepDef = {
  id: OnboardingStepId;
  titulo: string;
  descripcion: string;
  href: string;
  cta: string;
  required: boolean;
};

/** Orden y copy de los pasos del setup. */
export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: 'menu',
    titulo: 'Cargá tu menú',
    descripcion: 'Productos y precios. Podés importar un CSV o cargar a mano.',
    href: '/admin/menu',
    cta: 'Ir al menú',
    required: true,
  },
  {
    id: 'mesas',
    titulo: 'Armá el salón',
    descripcion: 'Creá al menos una mesa. Cada una tiene su QR para pedir.',
    href: '/admin/mesas',
    cta: 'Ir a mesas',
    required: true,
  },
  {
    id: 'pagos',
    titulo: 'Vinculá Mercado Pago',
    descripcion: 'Para cobrar desde el celular del comensal o en mostrador.',
    href: '/admin/configuracion',
    cta: 'Configurar pagos',
    required: true,
  },
  {
    id: 'caja',
    titulo: 'Abrí la caja',
    descripcion: 'Abrí un turno con fondo inicial. Sin caja no cobrás efectivo ni vendés en mostrador.',
    href: '/admin/caja',
    cta: 'Ir a caja',
    required: true,
  },
  {
    id: 'staff',
    titulo: 'Invitá al equipo',
    descripcion: 'Mozo, cocina o cajero con contraseña temporal.',
    href: '/admin/staff',
    cta: 'Invitar staff',
    required: false,
  },
  {
    id: 'landing',
    titulo: 'Personalizá tu página',
    descripcion: 'Dirección, horarios o foto de portada en tu subdominio.',
    href: '/admin/configuracion',
    cta: 'Personalizar',
    required: false,
  },
];

export function requiredStepIds(): OnboardingStepId[] {
  return ONBOARDING_STEPS.filter((s) => s.required).map((s) => s.id);
}
