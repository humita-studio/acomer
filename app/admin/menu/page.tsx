import { getCurrentSession } from '@/features/auth/session';
import { obtenerCategoriasMenu } from '@/features/menu/categoriasActions';
import { obtenerProductosMenu } from '@/features/menu/productosActions';
import { obtenerAdicionalesMenu } from '@/features/menu/modificadoresActions';
import { obtenerVariantesMenu } from '@/features/menu/variantesActions';
import { redirect } from 'next/navigation';
import { MenuManager } from '@/features/menu/components/MenuManager';

export default async function MenuPage() {
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
