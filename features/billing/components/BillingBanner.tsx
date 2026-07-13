import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { BillingSnapshot } from '../access';
import { Button } from '@/shared/ui/button';

/** Banner superior del admin cuando el trial/plan está por vencer o venció. */
export function BillingBanner({ billing }: { billing: BillingSnapshot }) {
  if (!billing.showPayBanner && billing.accessOk) return null;

  const critico = !billing.accessOk;

  return (
    <div
      className={
        critico
          ? 'border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-destructive'
          : 'border-b border-warning/30 bg-warning-subtle px-4 py-2.5 text-warning-foreground'
      }
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {critico
            ? 'Tu período de acomer venció. Reactivá el plan para seguir usando el panel.'
            : billing.daysLeft != null && billing.daysLeft > 0
              ? `Tu ${billing.billingStatus === 'trial' ? 'prueba' : 'período'} vence en ${billing.daysLeft} día${billing.daysLeft === 1 ? '' : 's'}.`
              : 'Tu plan necesita atención. Revisá facturación.'}
        </p>
        <Button asChild size="sm" variant={critico ? 'default' : 'outline'}>
          <Link href="/admin/billing">Ver plan y pagar</Link>
        </Button>
      </div>
    </div>
  );
}
