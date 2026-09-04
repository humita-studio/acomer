import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantDetails } from '@/features/tenant/get-tenant';
import { getConfigResenasPublicAction } from '@/features/resenas/resenasActions';
import { CalificarExperienciaWidget } from '@/features/resenas/components/CalificarExperienciaWidget';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OpinarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  const { tenant } = await params;
  const { mesa } = await searchParams;

  const rest = await getTenantDetails(tenant);
  if (!rest || rest.deletedAt) notFound();

  const [resenasConfig, landing] = await Promise.all([
    getConfigResenasPublicAction(tenant),
    obtenerLandingConfig(rest.id),
  ]);

  if (!resenasConfig?.activas) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 bg-muted/20">
        <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center shadow-sm space-y-3">
          <h1 className="text-xl font-bold">{rest.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            La recepción de opiniones no está disponible en este momento.
          </p>
          <Link
            href={`/${tenant}`}
            className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="mr-1 size-3.5" /> Ir al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-lg space-y-4">
        {/* Header con marca del restaurante */}
        <div className="text-center space-y-1">
          {landing.logoUrl ? (
            <img
              src={landing.logoUrl}
              alt={rest.nombre}
              className="mx-auto size-16 rounded-full object-cover border shadow-xs"
            />
          ) : null}
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {rest.nombre}
          </h2>
        </div>

        {/* Widget interactivo de calificación */}
        <CalificarExperienciaWidget
          slug={tenant}
          identificadorMesa={mesa ? `Mesa ${mesa}` : undefined}
          googleReviewUrl={resenasConfig.googleReviewUrl}
          minEstrellasGoogle={resenasConfig.minEstrellasGoogle}
          origen="directo"
        />

        <div className="text-center">
          <Link
            href={`/${tenant}`}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 size-3.5" /> Volver al menú
          </Link>
        </div>
      </div>
    </main>
  );
}
