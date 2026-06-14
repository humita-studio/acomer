import { db } from '@/shared/db';
import { pedidos, comandaItems, mesas, sesionesMesa } from '@/shared/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { KanbanBoard } from './kanban-board';

export default async function CocinaPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/login');

    // Solo owner, admin, cocina, mozo pueden ver esto
    const rolesPermitidos = ['owner', 'admin', 'cocina', 'mozo'];
    if (!rolesPermitidos.includes(session.role)) {
        redirect('/admin');
    }

    // Fetch initial data: Pedidos en curso (no Entregado, no Pagado)
    const pedidosData = await db
        .select({
            id: pedidos.id,
            estado: pedidos.estado,
            notas: pedidos.notas,
            createdAt: pedidos.createdAt,
            mesa: mesas.identificador,
        })
        .from(pedidos)
        .innerJoin(sesionesMesa, eq(pedidos.sesionMesaId, sesionesMesa.id))
        .innerJoin(mesas, eq(sesionesMesa.mesaId, mesas.id))
        .where(
            and(
                eq(pedidos.restauranteId, session.restauranteId),
                inArray(pedidos.estado, ['Pendiente', 'En Preparación', 'Listo'])
            )
        )
        .orderBy(pedidos.createdAt);

    // Fetch items para estos pedidos
    const pedidosIds = pedidosData.map(p => p.id);

    let itemsData: any[] = [];
    if (pedidosIds.length > 0) {
        itemsData = await db
            .select({
                id: comandaItems.id,
                pedidoId: comandaItems.pedidoId,
                cantidad: comandaItems.cantidad,
                nombre: comandaItems.nombreProductoSnapshot,
            })
            .from(comandaItems)
            .where(inArray(comandaItems.pedidoId, pedidosIds));
    }

    // Agrupar items por pedido
    const pedidosConItems = pedidosData.map(p => ({
        ...p,
        items: itemsData.filter(i => i.pedidoId === p.id),
    }));

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 flex-shrink-0">Monitor de Cocina</h1>
            <KanbanBoard initialPedidos={pedidosConItems} restauranteId={session.restauranteId} userRole={session.role} />
        </div>
    );
}
