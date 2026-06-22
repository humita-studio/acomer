'use client';

import { useState } from 'react';
import { MenuView } from '@/features/carta/components/MenuView';
import type { CategoriaMenu, ProductoMenu } from '@/features/carta/types';
import { useLocalCart } from '@/features/carta/useLocalCart';
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
}: {
  tenantSlug: string;
  tenantId: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
  // Modalidades habilitadas por el local (takeaway/delivery).
  modos: ModoPedido[];
}) {
  const cart = useLocalCart(tenantId);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
      />
      <CheckoutExterno
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        tenantSlug={tenantSlug}
        cartItems={cart.items}
        modos={modos}
      />
    </>
  );
}
