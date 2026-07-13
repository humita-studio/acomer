'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CreditCard, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatPeso, formatFecha } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import {
  elegirPlanAction,
  iniciarPagoSuscripcionAction,
  type BillingView,
} from '../billingActions';
import { PLANES_SAAS, type PlanId } from '../plans';

const ESTADO_PAGO: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export function BillingManager({
  initial,
  pagoState,
}: {
  initial: BillingView;
  pagoState?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [planSel, setPlanSel] = useState<PlanId>(
    view.plan === 'a_medida' ? 'pro' : view.plan,
  );
  const [pending, startTransition] = useTransition();
  const [paying, setPaying] = useState(false);

  const pagar = async () => {
    setPaying(true);
    try {
      const res = await iniciarPagoSuscripcionAction(planSel);
      if (!res.success || !res.paymentUrl) {
        toast.error(res.message ?? 'No se pudo iniciar el pago');
        return;
      }
      window.location.assign(res.paymentUrl);
    } catch {
      toast.error('Error de red al iniciar el pago');
    } finally {
      setPaying(false);
    }
  };

  const elegir = (id: PlanId) => {
    if (id === 'a_medida') {
      toast.message('Plan A medida', {
        description: 'Escribinos para armar una propuesta a tu medida.',
      });
      return;
    }
    setPlanSel(id);
    startTransition(async () => {
      const res = await elegirPlanAction(id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Plan y facturación</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná la suscripción de acomer para {view.planNombre.toLowerCase() === view.plan ? 'tu local' : `el plan ${view.planNombre}`}.
        </p>
      </div>

      {pagoState === 'exito' && (
        <div className="rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success-foreground">
          Pago recibido. Si el estado no se actualiza en unos segundos, recargá la página
          (el webhook puede tardar un momento).
        </div>
      )}
      {pagoState === 'error' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          El pago no se completó. Podés reintentar cuando quieras.
        </div>
      )}
      {pagoState === 'pendiente' && (
        <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-foreground">
          Pago pendiente de acreditación. Te avisamos cuando se confirme.
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Estado actual</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{view.label}</p>
          </div>
          <Badge variant={view.accessOk ? 'secondary' : 'destructive'}>
            {view.planNombre}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Prueba hasta</p>
              <p className="font-medium">
                {view.trialEndsAt ? formatFecha(view.trialEndsAt) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Período pago hasta</p>
              <p className="font-medium">
                {view.periodEndsAt ? formatFecha(view.periodEndsAt) : '—'}
              </p>
            </div>
          </div>
          {view.maxMesas != null && (
            <p className="text-muted-foreground">
              Límite del plan: hasta <strong>{view.maxMesas} mesas</strong>.
            </p>
          )}
          {!view.accessOk && (
            <p className="font-medium text-destructive">
              El acceso al panel está limitado hasta que reactives el plan.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Elegí tu plan</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(PLANES_SAAS) as PlanId[]).map((id) => {
            const p = PLANES_SAAS[id];
            const selected = planSel === id || (view.plan === id && id === 'a_medida');
            return (
              <button
                key={id}
                type="button"
                onClick={() => elegir(id)}
                disabled={pending || paying}
                className={cn(
                  'flex flex-col rounded-2xl border p-4 text-left transition-colors',
                  selected
                    ? 'border-primary ring-1 ring-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/40',
                  p.destacado && 'sm:scale-[1.02]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold">{p.nombre}</span>
                  {p.destacado && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-primary">
                      <Sparkles className="size-3" /> Popular
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold">
                  {p.precioMensual != null ? formatPeso(p.precioMensual) : 'Consultar'}
                  {p.precioMensual != null && (
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.descripcion}</p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-1.5 text-xs text-foreground">
                      <Check className="mt-0.5 size-3 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {planSel !== 'a_medida' && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                Pagar {PLANES_SAAS[planSel].nombre} ·{' '}
                {formatPeso(PLANES_SAAS[planSel].precioMensual ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                30 días de acceso desde el pago (o se suman si ya tenés período vigente).
                Mercado Pago · cuenta de acomer.
              </p>
              {!view.billingConfigured && (
                <p className="mt-2 text-sm text-warning-foreground">
                  Cobro online no configurado en este entorno. En producción hace falta
                  MP_BILLING_ACCESS_TOKEN.
                </p>
              )}
            </div>
            <Button
              size="lg"
              disabled={paying || !view.billingConfigured}
              onClick={() => void pagar()}
            >
              {paying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              {paying ? 'Redirigiendo…' : 'Pagar con Mercado Pago'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {view.historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay pagos de suscripción.</p>
          ) : (
            <ul className="divide-y">
              {view.historial.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {planDefNombre(h.plan)} · {ESTADO_PAGO[h.estado] ?? h.estado}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFecha(h.createdAt)}
                      {h.periodEnd ? ` · vigente hasta ${formatFecha(h.periodEnd)}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatPeso(h.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function planDefNombre(plan: string) {
  return PLANES_SAAS[plan as PlanId]?.nombre ?? plan;
}
