import { notFound } from 'next/navigation';
import { db } from '@/shared/db';
import { 
  categorias, 
  productos, 
  modificadores, 
  productosPrecios,
  modificadoresPrecios,
  productoModificadoresDisponibles,
  itemsBorradorMesa
} from '@/shared/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getOrCreateSesionMesa } from '@/features/comanda/sesion-mesa-actions';
import { MenuDigital, ProductoMenu, CategoriaMenu } from '@/features/comanda/components/MenuDigital';
import { RealtimeMesaSync } from '@/features/comanda/components/RealtimeMesaSync';
import type { CartItem } from '@/features/comanda/store';
import { getMetodosPago } from '@/features/pagos/get-metodos-pago';
import { obtenerTicketAction } from '@/features/pagos/obtener-ticket-action';
import { ResumenPago } from '@/features/pagos/components/ResumenPago';
import { obtenerTicketMesa } from '@/features/comanda/obtener-ticket-mesa';

type ModificadorSnapshot = {
  id: string;
  nombre: string;
  precioExtra: number;
};

export default async function ComandaPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ tenant: string, id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tenant, id: qrToken } = await params;
  const sp = await searchParams;

  // 1. Manejar vista de Ticket / Resumen si venimos de pagar
  const pagoState = sp?.pago as string | undefined;
  const tx = sp?.tx as string | undefined;

  if ((pagoState === 'exito' || pagoState === 'pendiente') && tx) {
    const ticketResult = await obtenerTicketAction(tx);
    if (ticketResult.success && ticketResult.data) {
      return <ResumenPago ticket={ticketResult.data} />;
    }
  }

  // 2. Obtener/Crear sesión de mesa
  const sessionResult = await getOrCreateSesionMesa(tenant, qrToken);
  if (!sessionResult.success || !sessionResult.sesionId || !sessionResult.tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600">{sessionResult.message}</p>
        </div>
      </div>
    );
  }

  const { tenantId, sesionId, mesaIdentificador } = sessionResult;

  // 3. Cargar Catálogo Activo
  // Categorías
  const cats = await db.select({ id: categorias.id, nombre: categorias.nombre })
    .from(categorias)
    .where(
      and(
        eq(categorias.restauranteId, tenantId),
        eq(categorias.activo, true),
        isNull(categorias.deletedAt)
      )
    )
    .orderBy(asc(categorias.createdAt));

  // Productos con precios vigentes
  const prods = await db.select({
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
      and(
        eq(productos.id, productosPrecios.productoId),
        isNull(productosPrecios.vigentaHsta)
      )
    )
    .where(
      and(
        eq(productos.restauranteId, tenantId),
        eq(productos.activo, true),
        isNull(productos.deletedAt)
      )
    );

  // Modificadores con precios vigentes
  const modsDisponibles = await db.select({
      productoId: productoModificadoresDisponibles.productoId,
      id: modificadores.id,
      nombre: modificadores.nombre,
      precioExtra: modificadoresPrecios.precioExtra,
    })
    .from(productoModificadoresDisponibles)
    .innerJoin(modificadores, eq(productoModificadoresDisponibles.modificadorId, modificadores.id))
    .innerJoin(
      modificadoresPrecios, 
      and(
        eq(modificadores.id, modificadoresPrecios.modificadorId),
        isNull(modificadoresPrecios.vigentaHsta)
      )
    )
    .where(
      and(
        eq(modificadores.restauranteId, tenantId),
        eq(modificadores.disponible, true),
        isNull(modificadores.deletedAt)
      )
    );

  // 4. Cargar borrador existente (items compartidos que ya están en el carrito)
  const borradorData = await db
    .select()
    .from(itemsBorradorMesa)
    .where(eq(itemsBorradorMesa.sesionMesaId, sesionId))
    .orderBy(asc(itemsBorradorMesa.createdAt));

  const initialCartItems: CartItem[] = borradorData.map((item) => ({
    id: item.id,
    productoId: item.productoId,
    nombre: item.nombreProducto,
    precioUnitario: parseFloat(item.precioUnitario?.toString() || '0'),
    cantidad: item.cantidad,
    modificadores: (item.modificadores as ModificadorSnapshot[]) || [],
  }));

  // 4b. Cargar el ticket acumulado de la mesa (pedidos confirmados)
  const { items: pedidosConfirmados } = await obtenerTicketMesa(sesionId);

  // Mapear DB a la estructura de la UI
  const menuProductos: ProductoMenu[] = prods.map(p => ({
    id: p.id,
    categoriaId: p.categoriaId,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: parseFloat(p.precio?.toString() || '0'),
    permiteAdicionales: p.permiteAdicionales,
    modificadores: p.permiteAdicionales ? modsDisponibles
      .filter(m => m.productoId === p.id)
      .map(m => ({
        id: m.id,
        nombre: m.nombre,
        precioExtra: parseFloat(m.precioExtra?.toString() || '0')
      })) : []
  }));

  // 5. Obtener Métodos de Pago Disponibles
  const metodosPago = await getMetodosPago(tenantId);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Realtime listener invisible — invalida el borrador y avisa a otros dispositivos */}
      <RealtimeMesaSync
        sesionMesaId={sesionId}
        tenantId={tenantId}
      />

      <header className="bg-white p-4 border-b text-center sticky top-0 z-20 shadow-sm">
        <h1 className="font-bold text-xl text-gray-800">Mesa {mesaIdentificador}</h1>
        <p className="text-sm text-gray-500">Sesión Compartida • Todos ven el mismo pedido</p>
      </header>

      <MenuDigital
        tenantId={tenantId}
        sesionMesaId={sesionId}
        mesaIdentificador={mesaIdentificador}
        categorias={cats as CategoriaMenu[]}
        productos={menuProductos}
        metodosPago={metodosPago}
        initialItems={initialCartItems}
        pedidosConfirmados={pedidosConfirmados}
      />
    </main>
  );
}
