import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { PLANES } from '../marketingContent';

/**
 * Planes de precios: tres tarjetas, con el plan "Pro" destacado (borde primario +
 * badge "Recomendado"). Cada CTA lleva a registro / ventas.
 */
export function MarketingPricing() {
  return (
    <section id="precios" className="bg-secondary/40 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Precios
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Planes simples, sin sorpresas
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Probá gratis 14 días. Sin tarjeta, sin permanencia.
          </p>
        </div>

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {PLANES.map((plan) => (
            <div
              key={plan.nombre}
              className={cn(
                'flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm',
                plan.destacado
                  ? 'border-primary ring-1 ring-primary lg:scale-[1.03]'
                  : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {plan.nombre}
                </h3>
                {plan.destacado ? <Badge>Recomendado</Badge> : null}
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-semibold text-foreground">
                  {plan.precio}
                </span>
                {plan.periodo ? (
                  <span className="text-sm text-muted-foreground">
                    {plan.periodo}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.descripcion}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    />
                    <span className="text-sm text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                variant={plan.destacado ? 'default' : 'outline'}
                className="mt-8 w-full"
              >
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
