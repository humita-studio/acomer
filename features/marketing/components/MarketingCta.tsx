import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { GRADIENTE_PRODUCTO } from '../marketingContent';

/**
 * CTA final sobre el gradiente de marca: invita a probar acomer y empuja a registro.
 */
export function MarketingCta() {
  return (
    <section className="bg-background px-4 py-16 sm:px-6 sm:py-20">
      <div
        className="mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-14 text-center text-white sm:px-12 sm:py-20"
        style={{ background: GRADIENTE_PRODUCTO }}
      >
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Sumá tecnología a tu salón hoy
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
          14 días gratis al registrarte. Configurás menú, mesas y cobros; después
          elegís plan y pagás con Mercado Pago.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-white/90"
          >
            <Link href="/register">
              Probar 14 días
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
          >
            <Link href="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
