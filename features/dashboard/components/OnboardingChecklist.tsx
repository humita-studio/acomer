'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Armchair,
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import {
  ONBOARDING_STEPS,
  type OnboardingStatus,
  type OnboardingStepId,
} from '../onboarding';

const ICONS: Record<OnboardingStepId, LucideIcon> = {
  menu: UtensilsCrossed,
  mesas: Armchair,
  pagos: CreditCard,
  landing: Store,
};

const COLLAPSE_KEY = 'acomer-onboarding-collapsed';

function wasCollapsed(tenantId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(`${COLLAPSE_KEY}:${tenantId}`) === '1';
  } catch {
    return false;
  }
}

function setCollapsed(tenantId: string, value: boolean) {
  try {
    const key = `${COLLAPSE_KEY}:${tenantId}`;
    if (value) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Checklist de primer día: menú → mesas → MP → landing.
 * La X solo lo **minimiza** (queda una barra para reabrir).
 * Se oculta del todo solo cuando lo obligatorio está completo.
 */
export function OnboardingChecklist({
  status,
  tenantId,
  nombreRestaurante,
  dominioPublico,
}: {
  status: OnboardingStatus;
  tenantId: string;
  nombreRestaurante: string;
  /** Host base sin protocolo, ej. "acomer.com.ar" o "localhost:3000". */
  dominioPublico?: string;
}) {
  const [minimizado, setMinimizado] = useState(() => wasCollapsed(tenantId));

  const byId = useMemo(() => {
    const m = new Map(status.steps.map((s) => [s.id, s]));
    return m;
  }, [status.steps]);

  if (status.listo) return null;

  const pct = status.total > 0 ? Math.round((status.hechos / status.total) * 100) : 0;
  const proximo = ONBOARDING_STEPS.find((def) => {
    const st = byId.get(def.id);
    return def.required && st && !st.done;
  });

  const proto =
    dominioPublico && !dominioPublico.includes('localhost') ? 'https' : 'http';
  const urlPublica =
    dominioPublico && status.slug
      ? `${proto}://${status.slug}.${dominioPublico}`
      : null;

  // Minimizado: barra compacta para reabrir (la X no lo borra).
  if (minimizado) {
    return (
      <Card className="border-primary/20 bg-primary/[0.04] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">
                Configuración incompleta · {status.hechos} de {status.total}
              </p>
              <p className="text-xs text-muted-foreground">
                {proximo ? proximo.titulo : 'Seguí con el setup del local'}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {proximo ? (
              <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-initial">
                <Link href={proximo.href}>
                  {proximo.cta}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-initial"
              onClick={() => {
                setCollapsed(tenantId, false);
                setMinimizado(false);
              }}
            >
              Ver pasos
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <h2 className="font-heading text-base font-semibold sm:text-lg">
                Configurá {nombreRestaurante} en 3 pasos
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Cuando termines, tus clientes ya pueden pedir por QR y pagar.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Minimizar checklist"
            title="Minimizar"
            onClick={() => {
              setCollapsed(tenantId, true);
              setMinimizado(true);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {status.hechos} de {status.total} listos
            </span>
            <span className="font-medium tabular-nums text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} aria-label={`Progreso de configuración: ${pct}%`} />
        </div>

        <ol className="space-y-2">
          {ONBOARDING_STEPS.map((def, index) => {
            const st = byId.get(def.id);
            const done = st?.done ?? false;
            const Icon = ICONS[def.id];
            const esProximo = proximo?.id === def.id;

            return (
              <li key={def.id}>
                <div
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
                    done && 'border-success/25 bg-success-subtle/40',
                    esProximo && !done && 'border-primary/40 bg-background shadow-sm',
                    !done && !esProximo && 'border-border/80 bg-background/60',
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        done
                          ? 'bg-success text-success-foreground'
                          : esProximo
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-4" /> : index + 1}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <p
                          className={cn(
                            'font-medium leading-snug',
                            done && 'text-muted-foreground line-through decoration-muted-foreground/50',
                          )}
                        >
                          {def.titulo}
                        </p>
                        {!def.required ? (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Opcional
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {st?.detalle && done ? st.detalle : def.descripcion}
                      </p>
                    </div>
                  </div>

                  {!done ? (
                    <Button
                      asChild
                      size="sm"
                      variant={esProximo ? 'default' : 'outline'}
                      className="w-full shrink-0 sm:w-auto"
                    >
                      <Link href={def.href}>
                        {def.cta}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 self-end text-xs font-medium text-success-foreground sm:self-center">
                      <Check className="size-3.5" aria-hidden />
                      Listo
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {urlPublica ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>Tu página pública:</span>
            <a
              href={urlPublica}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              {status.slug}.{dominioPublico}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
