import { getTenantDetails } from '@/features/tenant/get-tenant';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';
import { ahoraLocal, estaAbierto, horarioDeHoy } from '@/features/landing/landingConfig';
import { LandingHero } from '@/features/landing/components/LandingHero';
import { LandingAcciones } from '@/features/landing/components/LandingAcciones';

// El badge "Abierto/Cerrado" depende de la hora actual: renderizamos siempre
// fresco en vez de servir una versión cacheada.
export const dynamic = 'force-dynamic';

function NoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-center">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Local no encontrado</h1>
        <p className="mt-2 text-muted-foreground">Revisá el enlace e intentá de nuevo.</p>
      </div>
    </main>
  );
}

export default async function TenantPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const rest = await getTenantDetails(tenant);
  if (!rest || rest.deletedAt) return <NoEncontrado />;

  const config = await obtenerLandingConfig(rest.id);
  const ahora = ahoraLocal();
  const abierto = estaAbierto(config.horarios, ahora);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <LandingHero
          nombre={rest.nombre}
          descripcion={config.descripcion}
          direccion={config.direccion}
          abierto={abierto}
          horarioTexto={horarioDeHoy(config.horarios, ahora)}
          colorMarca={config.colorMarca}
        />
        <LandingAcciones
          acciones={config.acciones}
          colorMarca={config.colorMarca}
          redes={config.redes}
        />
      </div>
    </main>
  );
}
