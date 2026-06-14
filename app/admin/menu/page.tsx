import { db } from '@/shared/db';
import { categorias, productos, productosPrecios } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { MenuManager } from './menu-manager';

export default async function MenuPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/login');

    // Fetch data
    const categoriasData = await db
        .select()
        .from(categorias)
        .where(
            and(
                eq(categorias.restauranteId, session.restauranteId),
                isNull(categorias.deletedAt)
            )
        )
        .orderBy(categorias.createdAt);

    const productosData = await db
        .select({
            id: productos.id,
            categoriaId: productos.categoriaId,
            nombre: productos.nombre,
            descripcion: productos.descripcion,
            activo: productos.activo,
            precio: productosPrecios.precio,
        })
        .from(productos)
        .innerJoin(
            productosPrecios,
            and(
                eq(productos.id, productosPrecios.productoId),
                isNull(productosPrecios.vigentaHsta)
            )
        )
        .where(
            and(
                eq(productos.restauranteId, session.restauranteId),
                isNull(productos.deletedAt)
            )
        );

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestión de Menú</h1>
            <MenuManager
                categorias={categoriasData}
                productos={productosData}
                userRole={session.role}
            />
        </div>
    );
}
