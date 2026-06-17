import { db } from '@/shared/db';
import {
  categorias,
  productos,
  modificadores,
  productosPrecios,
  modificadoresPrecios,
  productoModificadoresDisponibles,
  itemsBorradorMesa,
  sesionesMesa,
  datosEntrega,
} from '@/shared/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { MenuDigital, ProductoMenu, CategoriaMenu } from '@/features/comanda/components/MenuDigital';
import { RealtimeMesaSync } from '@/features/comanda/components/RealtimeMesaSync';
import { MenuExterno } from '@/features/comanda/components/MenuExterno';
import type { CartItem } from '@/features/comanda/store';
import { getMetodosPago } from '@/features/pagos/get-metodos-pago';
import { obtenerTicketMesa } from '@/features/comanda/obtener-ticket-mesa';
import { obtenerTicketAction } from '@/features/pagos/obtener-ticket-action';
import { ResumenPago } from '@/features/pagos/components/ResumenPago';

type ModificadorSnapshot = {
  id: string;
  nombre: string;
  precioExtra: number;
};

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 text-center">
      <div className="bg-card p-8 rounded-2xl border shadow-sm">
        <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function PedirPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;

  const tenantId = await getTenantBySlug(tenant);
  if (!tenantId) return <ErrorBox message="Restaurante no encontrado" />;

  // Retorno de pago: MercadoPago vuelve a /pedir?pago=...&tx=... (sin el sesion),
  // así que mostramos el ticket/resumen en vez del formulario.
  const pagoState = typeof sp?.pago === 'string' ? sp.pago : undefined;
  const tx = typeof sp?.tx === 'string' ? sp.tx : undefined;
  if ((pagoState === 'exito' || pagoState === 'pendiente') && tx) {
    const ticketResult = await obtenerTicketAction(tx);
    if (ticketResult.success && ticketResult.data) {
      return <ResumenPago ticket={ticketResult.data} />;
    }
  }

  // Catálogo activo (mismas queries que la comanda de mesa). Lo necesitan tanto
  // el flujo "menú primero" (sin sesión) como el de la sesión externa.
  const cats = await db
    .select({ id: categorias.id, nombre: categorias.nombre })
    .from(categorias)
    .where(
      and(
        eq(categorias.restauranteId, tenantId),
        eq(categorias.activo, true),
        isNull(categorias.deletedAt),
      ),
    )
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
    .where(
      and(
        eq(productos.restauranteId, tenantId),
        eq(productos.activo, true),
        isNull(productos.deletedAt),
      ),
    );

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
      and(
        eq(modificadores.id, modificadoresPrecios.modificadorId),
        isNull(modificadoresPrecios.vigentaHsta),
      ),
    )
    .where(
      and(
        eq(modificadores.restauranteId, tenantId),
        eq(modificadores.disponible, true),
        isNull(modificadores.deletedAt),
      ),
    );

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
          .map((m) => ({
            id: m.id,
            nombre: m.nombre,
            precioExtra: parseFloat(m.precioExtra?.toString() || '0'),
          }))
      : [],
  }));

  // Paso 1: sin sesión → menú primero. El cliente arma el carrito (local) y
  // sólo en el checkout se crea sesión + datos de entrega + pedido.
  const sesionId = typeof sp?.sesion === 'string' ? sp.sesion : undefined;
  if (!sesionId) {
    return (
      <main className="min-h-screen bg-muted/30">
        <header className="bg-background p-4 border-b text-center sticky top-0 z-20 shadow-sm">
          <h1 className="font-bold text-xl">Hacé tu pedido</h1>
          <p className="text-sm text-muted-foreground">Elegí del menú y, al terminar, cómo lo querés recibir</p>
        </header>
        <MenuExterno
          tenantSlug={tenant}
          tenantId={tenantId}
          categorias={cats as CategoriaMenu[]}
          productos={menuProductos}
        />
      </main>
    );
  }

  // Paso 2: validar que la sesión sea de este tenant, externa y activa.
  const [sesion] = await db
    .select({
      id: sesionesMesa.id,
      tipo: sesionesMesa.tipo,
      estado: sesionesMesa.estado,
      nombreContacto: datosEntrega.nombreContacto,
    })
    .from(sesionesMesa)
    .leftJoin(datosEntrega, eq(datosEntrega.sesionMesaId, sesionesMesa.id))
    .where(and(eq(sesionesMesa.id, sesionId), eq(sesionesMesa.restauranteId, tenantId)))
    .limit(1);

  if (!sesion || (sesion.tipo !== 'takeaway' && sesion.tipo !== 'delivery')) {
    return <ErrorBox message="Pedido no encontrado" />;
  }
  if (sesion.estado !== 'Activa') {
    return <ErrorBox message="Este pedido ya fue cerrado." />;
  }

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

  const { items: pedidosConfirmados } = await obtenerTicketMesa(sesionId);

  const metodosPago = await getMetodosPago(tenantId);
  const etiqueta = sesion.tipo === 'delivery' ? 'Envío a domicilio' : 'Retiro en local';

  return (
    <main className="min-h-screen bg-muted/30">
      <RealtimeMesaSync sesionMesaId={sesionId} tenantId={tenantId} />

      <header className="bg-background p-4 border-b text-center sticky top-0 z-20 shadow-sm">
        <h1 className="font-bold text-xl">{etiqueta}</h1>
        <p className="text-sm text-muted-foreground">
          {sesion.nombreContacto ? `Pedido de ${sesion.nombreContacto}` : 'Tu pedido'}
        </p>
      </header>

      <MenuDigital
        tenantId={tenantId}
        sesionMesaId={sesionId}
        mesaIdentificador={sesion.nombreContacto ?? 'Pedido'}
        categorias={cats as CategoriaMenu[]}
        productos={menuProductos}
        metodosPago={metodosPago}
        initialItems={initialCartItems}
        pedidosConfirmados={pedidosConfirmados}
        modo="externo"
      />
    </main>
  );
}
