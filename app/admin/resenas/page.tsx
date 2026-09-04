import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getResenasAdminAction } from '@/features/resenas/resenasActions';
import { ResenasManager } from '@/features/resenas/components/ResenasManager';
import { Skeleton } from '@/shared/ui/skeleton';

function ResenasSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

async function ResenasContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  if (!canAccessSection(session.role, 'resenas')) {
    redirect('/unauthorized');
  }

  const data = await getResenasAdminAction();
  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No se pudieron cargar las reseñas. Por favor refrescá la página.
      </div>
    );
  }

  return <ResenasManager initialData={data} />;
}

export default function ResenasPage() {
  return (
    <Suspense fallback={<ResenasSkeleton />}>
      <ResenasContent />
    </Suspense>
  );
}
