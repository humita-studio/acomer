'use client';

import { useState } from 'react';
import { MenuView, type CategoriaMenu, type ProductoMenu } from './MenuDigital';
import { CheckoutExterno } from './CheckoutExterno';
import { useLocalCart } from '../cart/local-cart';

/**
 * Flujo externo "menú primero": la carta se ve sin identificarse, el carrito es
 * local (localStorage) y recién en el checkout se crea todo. Reusa MenuView.
 */
export function MenuExterno({
  tenantSlug,
  tenantId,
  categorias,
  productos,
}: {
  tenantSlug: string;
  tenantId: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
}) {
  const cart = useLocalCart(tenantId);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <>
      <MenuView
        tenantId={tenantId}
        mesaIdentificador="Tu pedido"
        categorias={categorias}
        productos={productos}
        cart={cart}
        pedidosConfirmados={[]}
        showMozo={false}
        pago={null}
        confirmLabel="Finalizar pedido"
        onConfirm={async () => {
          setCheckoutOpen(true);
          return { success: true };
        }}
        confirming={false}
        drawerTitulo="Tu pedido"
      />
      <CheckoutExterno
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        tenantSlug={tenantSlug}
        cartItems={cart.items}
      />
    </>
  );
}
