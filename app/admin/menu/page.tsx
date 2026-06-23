import { Suspense } from 'react';
import { getCurrentSession } from '@/features/auth/session';
import { obtenerCategoriasMenu } from '@/features/menu/categoriasActions';
import { obtenerProductosMenu } from '@/features/menu/productosActions';
import { obtenerAdicionalesMenu } from '@/features/menu/modificadoresActions';
import { obtenerVariantesMenu } from '@/features/menu/variantesActions';
import { redirect } from 'next/navigation';
import { MenuManager } from '@/features/menu/components/MenuManager';
import { Skeleton } from '@/shared/ui/skeleton';

function MenuSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-32" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-28" />
                </div>
            </div>
            {/* Tabs */}
            <Skeleton className="h-10 w-72" />
            {/* Barra de búsqueda */}
            <Skeleton className="h-9 w-64" />
            {/* Grid de productos */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    );
}

async function MenuContent() {
    const session = await getCurrentSession();
    if (!session) redirect('/login');

    // Estado de servidor que siembra la caché de TanStack Query en el cliente
    const [categoriasData, productosData, adicionalesData, variantesData] = await Promise.all([
        obtenerCategoriasMenu(),
        obtenerProductosMenu(),
        obtenerAdicionalesMenu(),
        obtenerVariantesMenu(),
    ]);

    return (
        <MenuManager
            categorias={categoriasData}
            productos={productosData}
            adicionales={adicionalesData}
            variantes={variantesData}
            userRole={session.role}
        />
    );
}

export default function MenuPage() {
    return (
        <Suspense fallback={<MenuSkeleton />}>
            <MenuContent />
        </Suspense>
    );
}
