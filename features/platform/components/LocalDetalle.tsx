'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { useConfirm } from '@/shared/hooks/use-confirm';
import { formatFecha, formatFechaHora } from '@/shared/lib/format';
import type { PlanId } from '@/features/billing/plans';
import {
  extendTrialAction,
  setLocalActivoAction,
  setLocalExemptAction,
  updateBillingStatusAction,
  updatePlanAction,
} from '../platformActions';
import {
  BILLING_STATUS_LABEL,
  PLAN_LABEL,
  type BillingStatus,
  type PlatformLocalDetalle,
} from '../types';

export function LocalDetalle({
  local: initial,
  publicUrl,
}: {
  local: PlatformLocalDetalle;
  publicUrl: string;
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [local, setLocal] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [trialDays, setTrialDays] = useState('90');

  const run = (fn: () => Promise<{ success: boolean; message: string }>) => {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {confirmDialog}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/platform/locales" className="hover:underline">
              Locales
            </Link>
            <span className="mx-1.5">/</span>
            {local.slug}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{local.nombre}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={local.activo ? 'secondary' : 'destructive'}>
              {local.activo ? 'Activo' : 'Inactivo'}
            </Badge>
            <Badge variant="outline">{PLAN_LABEL[local.plan]}</Badge>
            <Badge variant="outline">
              {BILLING_STATUS_LABEL[local.billingStatus]}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            Ver tenant
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Datos</CardTitle>
          <CardDescription>Identidad y fechas del local</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={local.id} mono />
          <Field label="Slug" value={local.slug} mono />
          <Field
            label="Alta"
            value={formatFechaHora(local.createdAt)}
          />
          <Field
            label="Trial hasta"
            value={local.trialEndsAt ? formatFecha(local.trialEndsAt) : '—'}
          />
          <Field
            label="Período hasta"
            value={local.periodEndsAt ? formatFecha(local.periodEndsAt) : '—'}
          />
          <Field
            label="Owner"
            value={
              local.owner
                ? `${local.owner.email ?? local.owner.userId}${local.owner.activo ? '' : ' (inactivo)'}`
                : 'Sin owner'
            }
          />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Billing y plan</CardTitle>
          <CardDescription>
            Cambios se aplican de inmediato. Se loguean con tu email de operador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <Select
                value={local.plan}
                disabled={pending}
                onValueChange={(v) => {
                  const plan = v as PlanId;
                  run(async () => {
                    const res = await updatePlanAction(local.id, plan);
                    if (res.success) setLocal((s) => ({ ...s, plan }));
                    return res;
                  });
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLAN_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Billing status
              </label>
              <Select
                value={local.billingStatus}
                disabled={pending}
                onValueChange={async (v) => {
                  const status = v as BillingStatus;
                  const ok = await confirm({
                    title: `¿Cambiar billing a “${BILLING_STATUS_LABEL[status]}”?`,
                    description: `Local ${local.nombre} (${local.slug}).`,
                    confirmLabel: 'Confirmar',
                  });
                  if (!ok) return;
                  run(async () => {
                    const res = await updateBillingStatusAction(local.id, status);
                    if (res.success) setLocal((s) => ({ ...s, billingStatus: status }));
                    return res;
                  });
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BILLING_STATUS_LABEL) as BillingStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {BILLING_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending || local.billingStatus === 'exempt'}
              onClick={async () => {
                const ok = await confirm({
                  title: '¿Marcar como exempt (piloto)?',
                  description: 'No se le cobrará suscripción mientras esté exempt.',
                  confirmLabel: 'Marcar exempt',
                });
                if (!ok) return;
                run(async () => {
                  const res = await setLocalExemptAction(local.id);
                  if (res.success) {
                    setLocal((s) => ({ ...s, billingStatus: 'exempt' }));
                  }
                  return res;
                });
              }}
            >
              Marcar exempt
            </Button>

            <div className="flex items-center gap-2">
              <Select value={trialDays} onValueChange={setTrialDays} disabled={pending}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                  <SelectItem value="180">180 días</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                disabled={pending}
                onClick={async () => {
                  const days = Number(trialDays);
                  const ok = await confirm({
                    title: `¿Extender trial ${days} días?`,
                    description:
                      'Pone billing en trial y mueve la fecha de fin desde ahora.',
                    confirmLabel: 'Extender',
                  });
                  if (!ok) return;
                  run(async () => {
                    const res = await extendTrialAction(local.id, days);
                    if (res.success) {
                      setLocal((s) => ({
                        ...s,
                        billingStatus: 'trial',
                        trialEndsAt: new Date(
                          Date.now() + days * 24 * 60 * 60 * 1000,
                        ).toISOString(),
                      }));
                    }
                    return res;
                  });
                }}
              >
                Extender trial
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Estado del local</CardTitle>
          <CardDescription>
            Desactivar no borra datos; el local deja de operar en la app pública.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant={local.activo ? 'destructive' : 'default'}
            disabled={pending}
            onClick={async () => {
              const next = !local.activo;
              const ok = await confirm({
                title: next ? '¿Activar local?' : '¿Desactivar local?',
                description: local.nombre,
                confirmLabel: next ? 'Activar' : 'Desactivar',
                variant: next ? 'default' : 'destructive',
              });
              if (!ok) return;
              run(async () => {
                const res = await setLocalActivoAction(local.id, next);
                if (res.success) setLocal((s) => ({ ...s, activo: next }));
                return res;
              });
            }}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : local.activo ? (
              'Desactivar local'
            ) : (
              'Activar local'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={mono ? 'break-all font-mono text-xs' : 'text-sm'}>{value}</div>
    </div>
  );
}
