import { getCurrentSession } from '@/features/auth/session';
import { obtenerCategoriasMenu } from '@/features/menu/categorias-actions';
import { obtenerProductosMenu } from '@/features/menu/productos-actions';
import { obtenerVariantesMenu } from '@/features/menu/modificadores-actions';
import { redirect } from 'next/navigation';
import { MenuManager } from './menu-manager';

export default async function MenuPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/login');

    // Estado de servidor que siembra la caché de TanStack Query en el cliente
    const [categoriasData, productosData, variantesData] = await Promise.all([
        obtenerCategoriasMenu(),
        obtenerProductosMenu(),
        obtenerVariantesMenu(),
    ]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestión de Menú</h1>
            <MenuManager
                categorias={categoriasData}
                productos={productosData}
                variantes={variantesData}
                userRole={session.role}
            />
        </div>
    );
}
