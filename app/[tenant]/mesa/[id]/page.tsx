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

  // 1. Manejar vista de Ticket / Resumen si venimos de pagar
  const pagoState = sp?.pago as string | undefined;
  const tx = sp?.tx as string | undefined;

  if ((pagoState === 'exito' || pagoState === 'pendiente') && tx) {
    const ticketResult = await obtenerTicketAction(tx);
    if (ticketResult.success && ticketResult.data) {
      return <ResumenPago ticket={ticketResult.data} />;
    }
  }

  // 2. Obtener/Crear sesión de mesa (o pedir elegir sector si la mesa está dividida)
  const cuenta = typeof sp?.cuenta === 'string' ? sp.cuenta : undefined;
  const sessionResult = await getOrCreateSesionMesa(tenant, qrToken, cuenta);

  if (!sessionResult.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 text-center">
        <div className="bg-card p-8 rounded-2xl border shadow-sm">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">{sessionResult.message}</p>
        </div>
      </div>
    );
  }

  // Mesa dividida: el comensal elige su sector desde el mismo QR impreso.
  if ('requiereSeleccion' in sessionResult && sessionResult.requiereSeleccion) {
    return <SelectorSubMesa qrToken={qrToken} opciones={sessionResult.opciones} />;
  }

  if (!sessionResult.sesionId || !sessionResult.tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 text-center">
        <div className="bg-card p-8 rounded-2xl border shadow-sm">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">No se pudo abrir la mesa.</p>
        </div>
      </div>
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
      <header className="bg-background p-4 border-b text-center shadow-sm">
        <h1 className="font-bold text-xl">Mesa {mesaIdentificador}</h1>
        <p className="text-sm text-muted-foreground">Sesión Compartida • Todos ven el mismo pedido</p>
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
