import { Card, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { FEATURES } from '../marketingContent';

/**
 * Grid de funciones del producto. Cada tarjeta usa un ícono de lucide sobre un
 * chip de color de marca (accent) + título y descripción, todo con tokens del DS.
 */
export function MarketingFeatures() {
  return (
    <section id="funciones" className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Funciones
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Una herramienta para cada parte del servicio
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Desde que el cliente se sienta hasta que pagás la cuenta, todo en un
            mismo lugar.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, titulo, descripcion }) => (
            <Card key={titulo} className="h-full">
              <CardHeader>
                <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-6" aria-hidden />
                </span>
                <CardTitle className="mt-4 font-display text-xl">
                  {titulo}
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  {descripcion}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
