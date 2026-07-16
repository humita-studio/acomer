'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { formatFecha } from '@/shared/lib/format';
import {
  BILLING_STATUS_LABEL,
  PLAN_LABEL,
  type BillingStatus,
  type PlatformLocalListItem,
} from '../types';
import type { PlanId } from '@/features/billing/plans';

function billingVariant(
  status: BillingStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'exempt':
      return 'secondary';
    case 'past_due':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function LocalesTable({
  initialLocales,
}: {
  initialLocales: PlatformLocalListItem[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [billing, setBilling] = useState<string>('all');
  const [plan, setPlan] = useState<string>('all');
  const [activo, setActivo] = useState<string>('all');
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialLocales.filter((l) => {
      if (needle) {
        const hay = `${l.nombre} ${l.slug}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (billing !== 'all' && l.billingStatus !== billing) return false;
      if (plan !== 'all' && l.plan !== plan) return false;
      if (activo === 'true' && !l.activo) return false;
      if (activo === 'false' && l.activo) return false;
      return true;
    });
  }, [initialLocales, q, billing, plan, activo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o slug…"
            className="pl-9"
            aria-label="Buscar locales"
          />
        </div>
        <Select value={billing} onValueChange={setBilling}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Billing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo billing</SelectItem>
            {(Object.keys(BILLING_STATUS_LABEL) as BillingStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {BILLING_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo plan</SelectItem>
            {(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PLAN_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activo} onValueChange={setActivo}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          Actualizar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {initialLocales.length} locales
      </p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Local</th>
              <th className="px-3 py-2.5 font-medium">Plan</th>
              <th className="px-3 py-2.5 font-medium">Billing</th>
              <th className="px-3 py-2.5 font-medium">Trial / período</th>
              <th className="px-3 py-2.5 font-medium">Estado</th>
              <th className="px-3 py-2.5 font-medium">Alta</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No hay locales con estos filtros.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/platform/locales/${l.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {l.nombre}
                    </Link>
                    <div className="text-xs text-muted-foreground">{l.slug}</div>
                  </td>
                  <td className="px-3 py-2.5">{PLAN_LABEL[l.plan] ?? l.plan}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={billingVariant(l.billingStatus)}>
                      {BILLING_STATUS_LABEL[l.billingStatus] ?? l.billingStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {l.trialEndsAt ? (
                      <div>Trial: {formatFecha(l.trialEndsAt)}</div>
                    ) : null}
                    {l.periodEndsAt ? (
                      <div>Período: {formatFecha(l.periodEndsAt)}</div>
                    ) : null}
                    {!l.trialEndsAt && !l.periodEndsAt ? '—' : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.activo ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="destructive">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatFecha(l.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
