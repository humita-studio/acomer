import Link from 'next/link';
import { db } from '@/shared/db';
import { itemsBorradorMesa, sesionesMesa, datosEntrega } from '@/shared/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import { MenuDigital } from '@/features/comanda/components/MenuDigital';
import type { CategoriaMenu } from '@/features/carta/types';
import { RealtimeMesaSync } from '@/features/comanda/components/RealtimeMesaSync';
import { MenuExterno } from '@/features/pedidos-online/components/MenuExterno';
import type { CartItem } from '@/features/carta/cart';
import { getMetodosPago } from '@/features/pagos/get-metodos-pago';
import { obtenerTicketMesa } from '@/features/pedidos/obtenerTicketMesa';
import { obtenerTicketAction } from '@/features/pagos/obtener-ticket-action';
import { ResumenPago } from '@/features/pagos/components/ResumenPago';
import { obtenerSeguimientoPedido } from '@/features/pedidos-online/obtenerSeguimiento';
import { SeguimientoPedido } from '@/features/pedidos-online/components/SeguimientoPedido';
import { obtenerDeliveryConfig } from '@/features/pedidos-online/deliveryConfigActions';
import { modosPermitidos, puedeAgregar } from '@/features/pedidos-online/deliveryConfig';
import { obtenerPromocionesPublicas } from '@/features/promociones/promosPublicasActions';

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

  // Config del local: qué modalidades ofrece y hasta cuándo se puede agregar.
  const config = await obtenerDeliveryConfig(tenantId);

  // Retorno de pago: MercadoPago vuelve a /pedir?pago=...&tx=... (sin el sesion),
  // así que mostramos el ticket/resumen en vez del formulario.
  const pagoState = typeof sp?.pago === 'string' ? sp.pago : undefined;
  const tx = typeof sp?.tx === 'string' ? sp.tx : undefined;
  if ((pagoState === 'exito' || pagoState === 'pendiente') && tx) {
    const ticketResult = await obtenerTicketAction(tx);
    if (ticketResult.success && ticketResult.data) {
      const d = ticketResult.data;
      // Retiro/envío → seguimiento del pedido (estado de entrega, estilo
      // Rappi/PedidosYa). Salón → ticket de pago como siempre.
      if (d.tipo === 'takeaway' || d.tipo === 'delivery') {
        const seg = await obtenerSeguimientoPedido(d.sesionMesaId);
        if (seg) {
          const metodosPago = await getMetodosPago(tenantId);
          return (
            <SeguimientoPedido
              pedido={seg}
              tenantId={tenantId}
              metodosPago={metodosPago}
              pagado={seg.pagado || pagoState === 'exito'}
              permiteAgregar={puedeAgregar(config, seg.estadoEntrega)}
            />
          );
        }
      }
      return <ResumenPago ticket={d} />;
    }
  }

  // Paso 1: sin sesión → menú primero. El cliente arma el carrito (local) y
  // sólo en el checkout se crea sesión + datos de entrega + pedido.
  const sesionId = typeof sp?.sesion === 'string' ? sp.sesion : undefined;
  if (!sesionId) {
    if (!config.activo) {
      return <ErrorBox message="El local no está tomando pedidos online en este momento." />;
    }
    // Catálogo + promos + métodos de pago: el flujo "menú primero" los necesita
    // acá (los métodos, para abrir el cobro apenas se confirma el pedido sin
    // navegar). El resto de los caminos no muestran el menú, así que no se cargan.
    const [{ categorias: cats, productos: menuProductos }, promos, metodosPago] = await Promise.all([
      obtenerCarta(tenantId),
      obtenerPromocionesPublicas(tenantId),
      getMetodosPago(tenantId),
    ]);
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
          modos={modosPermitidos(config)}
          promos={promos}
          metodosPago={metodosPago}
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

  // Una vez confirmado el primer pedido mostramos el seguimiento (estado de
  // entrega + pago + resumen). Sólo volvemos al menú si el local permite agregar
  // y el cliente lo pidió explícitamente (?agregar=1).
  const cerrada = sesion.estado !== 'Activa';
  const seg = await obtenerSeguimientoPedido(sesionId);
  const yaConfirmado = cerrada || (!!seg && seg.items.length > 0);
  const permiteAgregar = !!seg && !cerrada && puedeAgregar(config, seg.estadoEntrega);
  const modoAgregar = sp?.agregar === '1' && permiteAgregar;

  if (yaConfirmado && !modoAgregar) {
    if (seg) {
      const metodosPagoSeg = await getMetodosPago(tenantId);
      return (
        <SeguimientoPedido
          pedido={seg}
          tenantId={tenantId}
          metodosPago={metodosPagoSeg}
          pagado={seg.pagado}
          permiteAgregar={permiteAgregar}
          autoAbrirPago={sp?.pagar === '1'}
        />
      );
    }
    return <ErrorBox message="Este pedido ya fue cerrado." />;
  }

  // Flujo "agregar productos" (sesión activa, aún sin confirmar o ?agregar=1):
  // acá sí se muestra el menú, así que se cargan carta + promos + borrador +
  // pedidos + métodos en paralelo (son independientes entre sí).
  const [
    { categorias: cats, productos: menuProductos },
    promos,
    borradorData,
    { items: pedidosConfirmados },
    metodosPago,
  ] = await Promise.all([
    obtenerCarta(tenantId),
    obtenerPromocionesPublicas(tenantId),
    db
      .select()
      .from(itemsBorradorMesa)
      .where(eq(itemsBorradorMesa.sesionMesaId, sesionId))
      .orderBy(asc(itemsBorradorMesa.createdAt)),
    obtenerTicketMesa(sesionId),
    getMetodosPago(tenantId),
  ]);

  const initialCartItems: CartItem[] = borradorData.map((item) => ({
    id: item.id,
    productoId: item.productoId,
    varianteId: item.varianteId,
    nombre: item.nombreProducto,
    precioUnitario: parseFloat(item.precioUnitario?.toString() || '0'),
    cantidad: item.cantidad,
    modificadores: (item.modificadores as ModificadorSnapshot[]) || [],
  }));

  const etiqueta = sesion.tipo === 'delivery' ? 'Envío a domicilio' : 'Retiro en local';
  // Venimos del checkout (pagar=1) → abrir el pago apenas carga la pantalla.
  const autoAbrirPago = sp?.pagar === '1';

  return (
    <main className="min-h-screen bg-muted/30">
      <RealtimeMesaSync sesionMesaId={sesionId} tenantId={tenantId} />

      <header className="bg-background p-4 border-b text-center sticky top-0 z-20 shadow-sm">
        {modoAgregar && (
          <Link
            href={`/pedir?sesion=${sesionId}`}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Estado
          </Link>
        )}
        <h1 className="font-bold text-xl">{modoAgregar ? 'Agregar productos' : etiqueta}</h1>
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
        autoAbrirPago={autoAbrirPago}
        promos={promos}
        canal={sesion.tipo === 'delivery' ? 'delivery' : 'takeaway'}
      />
    </main>
  );
}
