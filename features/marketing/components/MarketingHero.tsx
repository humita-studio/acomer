import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DashboardPreview } from './DashboardPreview';
import { GRADIENTE_PRODUCTO } from '../marketingContent';

/**
 * Hero de la landing del producto: fondo cálido con gradiente terracota → marrón,
 * título en Fraunces, propuesta de valor y CTAs (Crear mi local + Ver cómo funciona).
 */
export function MarketingHero() {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: GRADIENTE_PRODUCTO }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <span className="size-2 rounded-full bg-white/90" aria-hidden />
            La plataforma para tu restaurante
          </span>

          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Todo tu restaurante, en una sola plataforma.
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-white/85">
            Comandas por QR, mesas, reservas, delivery y cobros — todo sincronizado
            en tiempo real. Menos caos en el salón, más mesas atendidas.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white text-primary hover:bg-white/90"
            >
              <Link href="/register">
                Crear mi local
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
            >
              <a href="#como-funciona">Ver cómo funciona</a>
            </Button>
          </div>

          <p className="mt-5 inline-flex items-center gap-2 text-sm text-white/75">
            <Check className="size-4" aria-hidden />
            Sin tarjeta · Configurá tu local en minutos
          </p>
        </div>

        <div className="lg:pl-4">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
