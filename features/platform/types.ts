import type { PlanId } from '@/features/billing/plans';

export type BillingStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'exempt';

export type PlatformLocalListItem = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  plan: PlanId;
  billingStatus: BillingStatus;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
  createdAt: string;
};

export type PlatformLocalDetalle = PlatformLocalListItem & {
  owner: {
    perfilId: string;
    userId: string;
    email: string | null;
    activo: boolean;
  } | null;
};

export type PlatformPagoReciente = {
  id: string;
  fecha: string;
  localId: string;
  localNombre: string;
  localSlug: string;
  plan: PlanId;
  monto: number;
  estado: string;
};

export type PlatformAtencionMotivo =
  | 'trial_por_vencer'
  | 'trial_vencido'
  | 'periodo_por_vencer'
  | 'vencido'
  | 'sin_actividad';

export type PlatformAtencion = {
  id: string;
  nombre: string;
  slug: string;
  motivo: PlatformAtencionMotivo;
  detalle: string;
};

export type PlatformStats = {
  total: number;
  activos: number;
  trial: number;
  exempt: number;
  pastDue: number;
  inactive: number;
  /** billing_status = active (pagando). */
  activosPago: number;
  nuevosMes: number;
  ingresos: {
    mesActual: number;
    mesAnterior: number;
    total: number;
    pagosMesActual: number;
  };
  /** Suma del precio mensual de los locales activos (pagando). */
  mrr: number;
  porVencer: { trial7: number; periodo7: number };
  uso: {
    pedidos30d: number;
    volumen30d: number;
    pedidosHoy: number;
    localesConActividad7d: number;
  };
  pagosRecientes: PlatformPagoReciente[];
  atencion: PlatformAtencion[];
  series: PlatformSeries;
};

export type PlatformSeries = {
  /** Últimos 6 meses ('YYYY-MM'), del más viejo al actual. */
  ingresosPorMes: Array<{ mes: string; monto: number; pagos: number }>;
  /** Últimos 30 días ('YYYY-MM-DD') en la zona del local. */
  pedidosPorDia: Array<{ dia: string; pedidos: number; volumen: number }>;
  altasPorMes: Array<{ mes: string; altas: number }>;
  /** Top 5 por cobrado a sus clientes en 30 días. */
  topLocales: Array<{ id: string; nombre: string; slug: string; volumen30d: number; pedidos30d: number }>;
};

export type PlatformListFilters = {
  q?: string;
  billingStatus?: BillingStatus | 'all';
  plan?: PlanId | 'all';
  activo?: 'all' | 'true' | 'false';
};

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  trial: 'Trial',
  active: 'Activo',
  past_due: 'Vencido',
  cancelled: 'Cancelado',
  exempt: 'Exempt (piloto)',
};

export const PLAN_LABEL: Record<PlanId, string> = {
  basico: 'Básico',
  pro: 'Pro',
  a_medida: 'A medida',
};
