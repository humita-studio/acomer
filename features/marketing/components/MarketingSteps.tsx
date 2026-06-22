import { PASOS } from '../marketingContent';

/**
 * "Cómo funciona": onboarding en tres pasos numerados, conectados con el flujo
 * real (crear cuenta → subdominio → carta → vender).
 */
export function MarketingSteps() {
  return (
    <section id="como-funciona" className="bg-secondary/40 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Cómo funciona
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Empezá en tres pasos
          </h2>
        </div>

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {PASOS.map((paso) => (
            <li key={paso.numero} className="relative">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
                {paso.numero}
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                {paso.titulo}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {paso.descripcion}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
