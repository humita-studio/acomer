import { Check } from 'lucide-react';
import { PhonePreview } from './PhonePreview';
import { SHOWCASE_BENEFICIOS } from '../marketingContent';

/**
 * Bloque "experiencia del comensal": copy a la izquierda + mockup del celular a
 * la derecha mostrando cómo se pide y paga desde la mesa.
 */
export function MarketingShowcase() {
  return (
    <section className="bg-background py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Experiencia del comensal
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Tus clientes piden y pagan sin esperar al mozo
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Escanean el QR, ven la carta, arman el pedido entre todos y pagan
            cuando quieren. Vos recibís todo ordenado en cocina y caja.
          </p>

          <ul className="mt-6 space-y-3">
            {SHOWCASE_BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="text-base text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 lg:order-2">
          <PhonePreview />
        </div>
      </div>
    </section>
  );
}
