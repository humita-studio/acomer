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
 * Planes de la landing (alineados a features/billing/plans.ts).
 * Trial real: 14 días al registrarse.
 */
export const PLANES: Plan[] = [
  {
    nombre: 'Básico',
    precio: '$ 14.900',
    periodo: '/mes',
    descripcion: 'Para arrancar con lo esencial.',
    features: [
      'Carta digital con QR',
      'Hasta 15 mesas',
      'Cocina y cobros',
      'Reportes del día',
      '14 días de prueba',
    ],
    cta: 'Probar 14 días',
    ctaHref: '/register',
  },
  {
    nombre: 'Pro',
    precio: '$ 29.900',
    periodo: '/mes',
    descripcion: 'El más elegido por restaurantes en marcha.',
    features: [
      'Todo lo de Básico',
      'Mesas ilimitadas',
      'Reservas + pedidos online',
      'Cobros con Mercado Pago',
      'Promociones y reportes',
      '14 días de prueba',
    ],
    cta: 'Probar 14 días',
    ctaHref: '/register',
    destacado: true,
  },
  {
    nombre: 'A medida',
    precio: 'Consultar',
    descripcion: 'Setup asistido y acompañamiento para tu local.',
    features: [
      'Todo lo de Pro',
      'Onboarding dedicado',
      'Soporte prioritario',
      'Prioridad en el roadmap',
    ],
    cta: 'Hablar con nosotros',
    ctaHref: '/register',
  },
];

/** Beneficios destacados de la experiencia del comensal. */
export const SHOWCASE_BENEFICIOS = [
  'Carta digital siempre actualizada',
  'Sesión compartida: todos ven el mismo pedido',
  'Pago con Mercado Pago, efectivo o tarjeta',
] as const;
