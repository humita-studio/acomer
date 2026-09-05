import { PLANES_SAAS, TRIAL_DAYS } from '@/features/billing/plans';
import { formatPeso } from '@/shared/lib/format';
import { SOPORTE_EMAIL } from '@/shared/lib/contacto';

import {
  QrCode,
  LayoutGrid,
  CalendarCheck,
  ShoppingBag,
  CreditCard,
  ChartColumn,
  type LucideIcon,
} from 'lucide-react';

/** Gradiente cálido del producto (terracota → marrón profundo), igual que la landing de tenant. */
export const GRADIENTE_PRODUCTO =
  'linear-gradient(155deg, #c2562f 0%, #6b2f18 55%, #2c1610 100%)';

/** Links del nav que apuntan a anclas de la propia landing. */
export const NAV_LINKS = [
  { href: '#funciones', label: 'Funciones' },
  { href: '#precios', label: 'Precios' },
  { href: '#como-funciona', label: 'Cómo funciona' },
] as const;

/**
 * Contacto comercial / soporte (editable acá hasta tener CRM).
 * WhatsApp sin + ni espacios; email de ventas.
 */
export const CONTACTO = {
  email: SOPORTE_EMAIL,
  /** Solo dígitos con código país, ej. 54911… — vacío = no mostrar WhatsApp */
  whatsapp: '',
  label: 'Escribinos',
} as const;

export type Feature = {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
};

/** Funciones del producto (espejo de las secciones reales del admin). */
export const FEATURES: Feature[] = [
  {
    icon: QrCode,
    titulo: 'Carta digital con QR',
    descripcion:
      'Tus clientes piden desde la mesa escaneando un QR. Sesión compartida y pedidos a cocina al instante.',
  },
  {
    icon: LayoutGrid,
    titulo: 'Mesas y plano del salón',
    descripcion:
      'Diseñá tu salón con arrastrar y soltar, y mirá el estado de cada mesa en vivo.',
  },
  {
    icon: CalendarCheck,
    titulo: 'Reservas online',
    descripcion:
      'Recibí reservas con cupos y turnos configurables. Sentá la mesa en un toque.',
  },
  {
    icon: ShoppingBag,
    titulo: 'Pedidos online',
    descripcion:
      'Takeaway y delivery con seguimiento del pedido en vivo y pago al confirmar.',
  },
  {
    icon: CreditCard,
    titulo: 'Cobros con Mercado Pago',
    descripcion:
      'Mercado Pago, efectivo o tarjeta. Cobrá en la mesa o que paguen desde el celular.',
  },
  {
    icon: ChartColumn,
    titulo: 'Reportes',
    descripcion:
      'Ventas, ticket promedio y rendimiento por hora. Tomá decisiones con datos reales.',
  },
];

export type Paso = {
  numero: string;
  titulo: string;
  descripcion: string;
};

/** Onboarding en tres pasos. */
export const PASOS: Paso[] = [
  {
    numero: '01',
    titulo: 'Configurá tu local',
    descripcion:
      'Creá tu cuenta, elegí tu subdominio y cargá tu menú, mesas y medios de pago. En minutos tenés todo listo para operar.',
  },
  {
    numero: '02',
    titulo: 'Compartí el QR',
    descripcion:
      'Imprimí los códigos de tus mesas o activá pedidos online. Tus clientes ya pueden pedir.',
  },
  {
    numero: '03',
    titulo: 'Cobrá y medí',
    descripcion:
      'Recibí pagos, seguí el salón en tiempo real y mirá tus reportes de ventas.',
  },
];

export type Plan = {
  nombre: string;
  precio: string;
  periodo?: string;
  descripcion: string;
  features: string[];
  cta: string;
  ctaHref: string;
  destacado?: boolean;
};

/**
 * Oferta de la landing. Sale del catálogo real (`features/billing/plans.ts`),
 * así la landing nunca promete algo distinto al panel.
 */
export const PLANES: Plan[] = (['basico', 'pro', 'a_medida'] as const).map((id) => {
  const def = PLANES_SAAS[id];
  const pago = def.precioMensual != null;
  return {
    nombre: def.nombre,
    precio: pago ? formatPeso(def.precioMensual as number) : 'Consultar',
    periodo: pago ? 'por mes' : undefined,
    descripcion: pago ? `${def.descripcion} ${TRIAL_DAYS} días gratis, sin tarjeta.` : def.descripcion,
    features: def.features,
    cta: pago ? `Probar ${TRIAL_DAYS} días gratis` : 'Hablar con nosotros',
    ctaHref: pago ? '/register' : `mailto:${SOPORTE_EMAIL}`,
    destacado: def.destacado,
  };
});

/** Encabezado de la sección de precios, coherente con la oferta. */
export const PRECIOS_ENCABEZADO = {
  titulo: `Probá ${TRIAL_DAYS} días gratis y después elegí tu plan`,
  subtitulo:
    'Sin tarjeta para empezar. Todo el producto desde el primer día; el plan solo cambia el acompañamiento.',
};

/** Beneficios destacados de la experiencia del comensal. */
export const SHOWCASE_BENEFICIOS = [
  'Carta digital siempre actualizada',
  'Sesión compartida: todos ven el mismo pedido',
  'Pago con Mercado Pago, efectivo o tarjeta',
] as const;
