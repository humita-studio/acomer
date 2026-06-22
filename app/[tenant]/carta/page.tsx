import { getTenantDetails } from '@/features/tenant/get-tenant';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import { CartaPublica } from '@/features/carta/components/CartaPublica';

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

export default async function CartaPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const rest = await getTenantDetails(tenant);
  if (!rest || rest.deletedAt) return <NoEncontrado />;

  const { categorias, productos } = await obtenerCarta(rest.id);

  return <CartaPublica nombre={rest.nombre} categorias={categorias} productos={productos} />;
}
