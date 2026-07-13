import { db } from '@/shared/db';
import { itemsBorradorMesa } from '@/shared/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getOrCreateSesionMesa } from '@/features/comanda/sesion-mesa-actions';
import { obtenerCarta } from '@/features/carta/obtenerCarta';
import { MenuDigital } from '@/features/comanda/components/MenuDigital';
import type { CategoriaMenu } from '@/features/carta/types';
import { SelectorSubMesa } from '@/features/comanda/components/SelectorSubMesa';
import { RealtimeMesaSync } from '@/features/comanda/components/RealtimeMesaSync';
import type { CartItem } from '@/features/carta/cart';
import { getMetodosPago } from '@/features/pagos/get-metodos-pago';
import { obtenerTicketAction } from '@/features/pagos/obtener-ticket-action';
import { ResumenPago } from '@/features/pagos/components/ResumenPago';
import { obtenerTicketMesa } from '@/features/pedidos/obtenerTicketMesa';
import { obtenerPromocionesPublicas } from '@/features/promociones/promosPublicasActions';

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

  // 1. Ticket / resumen al volver de MP o pedir cuenta presencial
  const pagoState = typeof sp?.pago === 'string' ? sp.pago : undefined;
  const tx = typeof sp?.tx === 'string' ? sp.tx : undefined;

  if (
    tx &&
    (pagoState === 'exito' ||
      pagoState === 'pendiente' ||
      pagoState === 'error')
  ) {
    const ticketResult = await obtenerTicketAction(tx);
    if (ticketResult.success && ticketResult.data) {
      return <ResumenPago ticket={ticketResult.data} pagoState={pagoState} />;
    }
    // tx inválida o no accesible: mensaje claro en vez de caer a la carta mudamente
    if (pagoState === 'error') {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
            <h1 className="font-display text-2xl font-semibold text-destructive">
              No se pudo completar el pago
            </h1>
            <p className="text-sm text-muted-foreground">
              Volvé a la carta e intentá de nuevo, o pedile al mozo que te cobre en la mesa.
            </p>
            <a
              href={`/mesa/${qrToken}`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Volver a la mesa
            </a>
          </div>
        </main>
      );
    }
  }

  // 2. Obtener/Crear sesión de mesa (o pedir elegir sector si la mesa está dividida)
  const cuenta = typeof sp?.cuenta === 'string' ? sp.cuenta : undefined;
  const sessionResult = await getOrCreateSesionMesa(tenant, qrToken, cuenta);

  if (!sessionResult.success) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4 text-center">
        <div className="w-full max-w-md space-y-3 rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-semibold text-destructive">
            No pudimos abrir la mesa
          </h1>
          <p className="text-sm text-muted-foreground">{sessionResult.message}</p>
          <p className="text-xs text-muted-foreground">
            Pedile al mozo un QR nuevo o que abra la mesa desde el panel.
          </p>
        </div>
      </main>
    );
  }

  // Mesa dividida: el comensal elige su sector desde el mismo QR impreso.
  if ('requiereSeleccion' in sessionResult && sessionResult.requiereSeleccion) {
    return <SelectorSubMesa qrToken={qrToken} opciones={sessionResult.opciones} />;
  }

  if (!sessionResult.sesionId || !sessionResult.tenantId) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4 text-center">
        <div className="w-full max-w-md space-y-3 rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-semibold text-destructive">
            No se pudo abrir la mesa
          </h1>
          <p className="text-sm text-muted-foreground">
            Hubo un problema al iniciar la sesión. Probá escanear el QR de nuevo.
          </p>
        </div>
      </main>
    );
  }

  const { tenantId, sesionId, mesaIdentificador } = sessionResult;

  // 3. Cargar catálogo activo (categorías + productos con adicionales y variantes)
  const { categorias: cats, productos: menuProductos } = await obtenerCarta(tenantId);

  // 4. Cargar borrador existente (items compartidos que ya están en el carrito)
  const borradorData = await db
    .select()
    .from(itemsBorradorMesa)
    .where(eq(itemsBorradorMesa.sesionMesaId, sesionId))
    .orderBy(asc(itemsBorradorMesa.createdAt));

  const initialCartItems: CartItem[] = borradorData.map((item) => ({
    id: item.id,
    productoId: item.productoId,
    varianteId: item.varianteId,
    nombre: item.nombreProducto,
    precioUnitario: parseFloat(item.precioUnitario?.toString() || '0'),
    cantidad: item.cantidad,
    modificadores: (item.modificadores as ModificadorSnapshot[]) || [],
  }));

  // 4b. Cargar el ticket acumulado de la mesa (pedidos confirmados)
  const { items: pedidosConfirmados } = await obtenerTicketMesa(sesionId);

  // 5. Obtener Métodos de Pago Disponibles
  const metodosPago = await getMetodosPago(tenantId);

  // 6. Promos vigentes del local (para mostrar y previsualizar el descuento)
  const promos = await obtenerPromocionesPublicas(tenantId);

  return (
    <main className="min-h-screen bg-muted/30">
      {/* Realtime listener invisible — invalida el borrador y avisa a otros dispositivos */}
      <RealtimeMesaSync
        sesionMesaId={sesionId}
        tenantId={tenantId}
      />

      {/* No sticky: MenuView ya fija las categorías. Dos sticky top-0 se pisan. */}
      <header className="border-b bg-background p-4 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Mesa {mesaIdentificador}
        </h1>
        <p className="text-sm text-muted-foreground">
          Pedido compartido · enviá a cocina y pagá cuando quieras
        </p>
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
        promos={promos}
        canal="salon"
      />
    </main>
  );
}
