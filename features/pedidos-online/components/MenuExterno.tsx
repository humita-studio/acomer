'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MenuView } from '@/features/carta/components/MenuView';
import type { CategoriaMenu, ProductoMenu } from '@/features/carta/types';
import type { CartItem, CartPromoDisponible } from '@/features/carta/cart';
import { useLocalCart, useLocalCartStore } from '@/features/carta/useLocalCart';
import { PaymentMethodModal } from '@/features/pagos/components/PaymentMethodModal';
import type { MetodoPago } from '@/features/pagos/get-metodos-pago';
import {
  type Promocion,
  type PromoCanal,
  type PromoMetodoPago,
  promoCondicionResumen,
  promoTipoBadge,
  promosVisibles,
} from '@/features/promociones/promociones';
import { calcularPromosCarrito } from '@/features/promociones/promosCarrito';
import { CheckoutExterno } from './CheckoutExterno';
import type { ModoPedido } from '../deliveryConfig';

/**
 * Flujo externo "menú primero": la carta se ve sin identificarse, el carrito es
 * local (localStorage) y recién en el checkout se crea todo. Reusa MenuView.
 */
export function MenuExterno({
  tenantSlug,
  tenantId,
  categorias,
  productos,
  modos,
  promos = [],
  metodosPago,
}: {
  tenantSlug: string;
  tenantId: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
  // Modalidades habilitadas por el local (takeaway/delivery).
  modos: ModoPedido[];
  // Promos vigentes del local (para mostrar y previsualizar el descuento).
  promos?: Promocion[];
  // Métodos de pago del local: para abrir el cobro apenas se confirma el pedido,
  // sin navegar a la pantalla de seguimiento primero.
  metodosPago: MetodoPago[];
}) {
  const router = useRouter();
  const cart = useLocalCart(tenantId);
  const limpiarCarrito = useLocalCartStore((s) => s.limpiar);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Sesión recién creada cuyo pago se está cobrando in-place (modal abierto).
  const [sesionPago, setSesionPago] = useState<string | null>(null);
  // Snapshot del carrito + canal al confirmar: lo que se acaba de pedir ES la
  // cuenta, así el modal de pago calcula el descuento por método en el cliente
  // (sin "Calculando…"). Se captura antes de limpiar el carrito.
  const [itemsPago, setItemsPago] = useState<CartItem[]>([]);
  const [canalPago, setCanalPago] = useState<PromoCanal>('takeaway');

  // Pedido confirmado: limpiamos el carrito local, cerramos el checkout y abrimos
  // el cobro sobre esta misma pantalla. Si el local no tiene métodos de pago
  // online, vamos directo al seguimiento (no hay nada que cobrar acá).
  const handlePedidoCreado = (sesionId: string, tipo: ModoPedido) => {
    setItemsPago(cart.items);
    setCanalPago(tipo);
    limpiarCarrito();
    setCheckoutOpen(false);
    if (metodosPago.length > 0) {
      setSesionPago(sesionId);
    } else {
      router.push(`/pedir?sesion=${sesionId}`);
    }
  };

  // Descuento por método sobre lo recién pedido, con el motor puro (instantáneo).
  const previewPago = useCallback(
    (metodo: PromoMetodoPago) =>
      calcularPromosCarrito(itemsPago, productos, promos, { metodoPago: metodo, canal: canalPago }),
    [itemsPago, productos, promos, canalPago],
  );

  // Cerrar el cobro sin pagar → llevar al seguimiento del pedido (ya existe en
  // DB). El pago en sí navega solo (window.location) al ticket/seguimiento.
  const handleCerrarPago = () => {
    const sesionId = sesionPago;
    setSesionPago(null);
    if (sesionId) router.push(`/pedir?sesion=${sesionId}`);
  };

  // Las modalidades online son canales de promo válidos (takeaway/delivery). El
  // comensal todavía no eligió cuál, así que el preview usa un canal concreto sólo
  // si hay una sola modalidad; con ambas va null (el motor descarta las promos por
  // canal hasta el checkout). La lista informativa sí filtra por ambos canales.
  const canales = modos as PromoCanal[];
  const canalPreview = canales.length === 1 ? canales[0] : null;
  const preview = useMemo(
    () => calcularPromosCarrito(cart.items, productos, promos, { canal: canalPreview }),
    [cart.items, productos, promos, canalPreview],
  );
  const promosDisponibles: CartPromoDisponible[] = promosVisibles(promos, canales).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    badge: promoTipoBadge(p.tipo, p.valor),
    condicion: promoCondicionResumen(p) || undefined,
  }));

  return (
    <>
      <MenuView
        categorias={categorias}
        productos={productos}
        cart={cart}
        pedidosConfirmados={[]}
        confirmLabel="Finalizar pedido"
        onConfirm={async () => {
          setCheckoutOpen(true);
          return { success: true };
        }}
        confirming={false}
        drawerTitulo="Tu pedido"
        promosDisponibles={promosDisponibles}
        promoResumen={preview}
      />
      <CheckoutExterno
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        tenantSlug={tenantSlug}
        cartItems={cart.items}
        modos={modos}
        promoResumen={preview}
        onPedidoCreado={handlePedidoCreado}
      />
      <PaymentMethodModal
        isOpen={!!sesionPago}
        onClose={handleCerrarPago}
        sesionMesaId={sesionPago ?? ''}
        tenantId={tenantId}
        metodosPago={metodosPago}
        externo
        previewLocal={previewPago}
      />
    </>
  );
}
