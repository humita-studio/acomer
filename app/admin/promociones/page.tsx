import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/shared/db';
import { categorias, productos } from '@/shared/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { listarPromocionesAction } from '@/features/promociones/promocionesActions';
import { PromocionesManager } from '@/features/promociones/components/PromocionesManager';
import { Skeleton } from '@/shared/ui/skeleton';

function PromocionesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

async function PromocionesContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  // Mismo público que el menú (owner/admin gestionan la carta y las promos).
  if (!canAccessSection(session.role, 'menu')) redirect('/unauthorized');

  const [promosRes, cats, prods] = await Promise.all([
    listarPromocionesAction(),
    db
      .select({ id: categorias.id, nombre: categorias.nombre })
      .from(categorias)
      .where(and(eq(categorias.restauranteId, session.restauranteId), isNull(categorias.deletedAt)))
      .orderBy(asc(categorias.nombre)),
    db
      .select({ id: productos.id, nombre: productos.nombre, categoriaId: productos.categoriaId })
      .from(productos)
      .where(and(eq(productos.restauranteId, session.restauranteId), isNull(productos.deletedAt)))
      .orderBy(asc(productos.nombre)),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Promociones</h1>
        <p className="text-muted-foreground">
          Descuentos y combos que se aplican solos al cobrar según las condiciones que definas.
        </p>
      </div>

      <PromocionesManager
        initialPromos={promosRes.promociones}
        categorias={cats}
        productos={prods}
      />
    </div>
  );
}

export default function PromocionesPage() {
  return (
    <Suspense fallback={<PromocionesSkeleton />}>
      <PromocionesContent />
    </Suspense>
  );
}
