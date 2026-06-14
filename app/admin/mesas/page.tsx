import { db } from '@/shared/db';
import { mesas } from '@/shared/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { MesasManager } from './mesas-manager';
import { headers } from 'next/headers';

export default async function MesasPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/login');

    const { sesionesMesa } = await import('@/shared/db/schema');

    const mesasData = await db
        .select()
        .from(mesas)
        .where(
            and(
                eq(mesas.restauranteId, session.restauranteId),
                isNull(mesas.deletedAt)
            )
        )
        .orderBy(mesas.createdAt);

    const sesionesActivas = await db
        .select({ mesaId: sesionesMesa.mesaId })
        .from(sesionesMesa)
        .where(
            and(
                eq(sesionesMesa.restauranteId, session.restauranteId),
                eq(sesionesMesa.estado, 'Activa')
            )
        );

    const mesasConEstado = mesasData.map(mesa => ({
        ...mesa,
        ocupada: sesionesActivas.some(s => s.mesaId === mesa.id)
    }));

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    // Obtener el slug del restaurante
    const { restaurantes } = await import('@/shared/db/schema');
    const tenantData = await db.select({ slug: restaurantes.slug })
        .from(restaurantes)
        .where(eq(restaurantes.id, session.restauranteId))
        .limit(1);
    
    const tenantSlug = tenantData[0]?.slug || 'demo';

    // Reemplazamos el localhost base por el subdominio
    let origin = `${protocol}://${host}`;
    if (host.includes('localhost')) {
        origin = `http://${tenantSlug}.localhost:3000`;
    } else {
        // En prod, ej: host = app.acomer.com.ar -> comer.com.ar
        const baseDomain = host.replace('app.', '');
        origin = `https://${tenantSlug}.${baseDomain}`;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestión de Mesas</h1>
            <MesasManager mesas={mesasConEstado} origin={origin} userRole={session.role} tenantId={session.restauranteId} />
        </div>
    );
}
