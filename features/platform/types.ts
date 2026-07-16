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

export type PlatformStats = {
  total: number;
  activos: number;
  trial: number;
  exempt: number;
  pastDue: number;
  inactive: number;
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
