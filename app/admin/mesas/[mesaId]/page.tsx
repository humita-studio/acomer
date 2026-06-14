import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/shared/db';
import {
  mesas,
  sesionesMesa,
  categorias,
  productos,
  modificadores,
  productosPrecios,
  modificadoresPrecios,
  productoModificadoresDisponibles,
} from '@/shared/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { obtenerTicketMesa } from '@/features/comanda/obtener-ticket-mesa';
import type { ProductoMenu, CategoriaMenu } from '@/features/comanda/components/MenuDigital';
import { MesaPedidoManager } from './mesa-pedido-manager';

export default async function MesaPedidoPage({
  params,
}: {
  params: Promise<{ mesaId: string }>;
}) {
  const { mesaId } = await params;

  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'canTakeOrders')) redirect('/unauthorized');

  const tenantId = session.restauranteId;

  // 1. Mesa (del tenant)
  const mesaData = await db
    .select()
    .from(mesas)
    .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt)))
    .limit(1);
  const mesa = mesaData[0];
  if (!mesa) notFound();

  // 2. Sesión activa de la mesa
  const sesionData = await db
    .select()
    .from(sesionesMesa)
    .where(and(eq(sesionesMesa.mesaId, mesaId), eq(sesionesMesa.estado, 'Activa')))
    .limit(1);
  const sesion = sesionData[0];

  // 3. Ticket acumulado (si hay sesión)
  const ticket = sesion ? await obtenerTicketMesa(sesion.id) : { items: [], total: 0 };

  // 4. Catálogo activo (mismas queries que la carta del comensal)
  const cats = await db
    .select({ id: categorias.id, nombre: categorias.nombre })
    .from(categorias)
    .where(and(eq(categorias.restauranteId, tenantId), eq(categorias.activo, true), isNull(categorias.deletedAt)))
    .orderBy(asc(categorias.createdAt));

  const prods = await db
    .select({
      id: productos.id,
      categoriaId: productos.categoriaId,
      nombre: productos.nombre,
      descripcion: productos.descripcion,
      permiteAdicionales: productos.permiteAdicionales,
      precio: productosPrecios.precio,
    })
    .from(productos)
    .innerJoin(
      productosPrecios,
      and(eq(productos.id, productosPrecios.productoId), isNull(productosPrecios.vigentaHsta)),
    )
    .where(and(eq(productos.restauranteId, tenantId), eq(productos.activo, true), isNull(productos.deletedAt)));

  const modsDisponibles = await db
    .select({
      productoId: productoModificadoresDisponibles.productoId,
      id: modificadores.id,
      nombre: modificadores.nombre,
      precioExtra: modificadoresPrecios.precioExtra,
    })
    .from(productoModificadoresDisponibles)
    .innerJoin(modificadores, eq(productoModificadoresDisponibles.modificadorId, modificadores.id))
    .innerJoin(
      modificadoresPrecios,
      and(eq(modificadores.id, modificadoresPrecios.modificadorId), isNull(modificadoresPrecios.vigentaHsta)),
    )
    .where(and(eq(modificadores.restauranteId, tenantId), eq(modificadores.disponible, true), isNull(modificadores.deletedAt)));

  const menuProductos: ProductoMenu[] = prods.map((p) => ({
    id: p.id,
    categoriaId: p.categoriaId,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: parseFloat(p.precio?.toString() || '0'),
    permiteAdicionales: p.permiteAdicionales,
    modificadores: p.permiteAdicionales
      ? modsDisponibles
          .filter((m) => m.productoId === p.id)
          .map((m) => ({ id: m.id, nombre: m.nombre, precioExtra: parseFloat(m.precioExtra?.toString() || '0') }))
      : [],
  }));

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/mesas" className="text-sm text-blue-600 hover:underline">
          ← Volver a Mesas
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-1">{mesa.identificador}</h1>
      </div>

      {!sesion ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Esta mesa no tiene una sesión activa. Cuando un comensal escanee el QR se abrirá una
          y vas a poder cargar pedidos a su cuenta.
        </div>
      ) : (
        <MesaPedidoManager
          mesaId={mesa.id}
          sesionMesaId={sesion.id}
          categorias={cats as CategoriaMenu[]}
          productos={menuProductos}
          ticketInicial={ticket}
        />
      )}
    </div>
  );
}
