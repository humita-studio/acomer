'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { MenuView } from '@/features/carta/components/MenuView';
import type { CategoriaMenu, ProductoMenu } from '@/features/carta/types';
import type { CartApi, CartPromoDisponible, PedidoConfirmadoResumen } from '@/features/carta/cart';
import {
  type Promocion,
  type PromoCanal,
  promoCondicionResumen,
  promoTipoBadge,
  promosVisibles,
} from '@/features/promociones/promociones';
import { calcularPromosCarrito } from '@/features/promociones/promosCarrito';
import { PaymentMethodModal } from '../../pagos/components/PaymentMethodModal';
import type { MetodoPago } from '../../pagos/get-metodos-pago';
import { llamarMozoAction } from '../sesion-mesa-actions';
import { useServerCart } from '../cart/use-cart';
import { useEnviarPedido } from '../use-borrador';

// ============================================================================
// MenuDigital: wrapper con carrito server-side (borrador por sesión). Liga la
// carta (MenuView) a comanda: borrador, "llamar al mozo" y el modal de pago.
// Lo usan el salón (QR) y el externo con sesión (/pedir?sesion=). Firma estable.
// ============================================================================

type MenuDigitalProps = {
    tenantId: string;
    sesionMesaId: string;
    mesaIdentificador: string;
    categorias: CategoriaMenu[];
    productos: ProductoMenu[];
    metodosPago: MetodoPago[];
    initialItems: CartApi['items'];
    pedidosConfirmados?: PedidoConfirmadoResumen[];
    // 'mesa' (salón, con QR) | 'externo' (takeaway/delivery, sin mesa física)
    modo?: 'mesa' | 'externo';
    // Abrir el pago al montar (viene del checkout externo con pagar=1).
    autoAbrirPago?: boolean;
    // Promos vigentes del local (para mostrar) y canal de esta superficie.
    promos?: Promocion[];
    canal?: PromoCanal;
};

export function MenuDigital({
    tenantId,
    sesionMesaId,
    mesaIdentificador,
    categorias,
    productos,
    metodosPago,
    initialItems,
    pedidosConfirmados = [],
    modo = 'mesa',
    autoAbrirPago = false,
    promos = [],
    canal = 'salon',
}: MenuDigitalProps) {
    const cart = useServerCart(tenantId, sesionMesaId, initialItems);
    const enviar = useEnviarPedido(tenantId, sesionMesaId);

    const preview = useMemo(
        () => calcularPromosCarrito(cart.items, productos, promos, { canal }),
        [cart.items, productos, promos, canal],
    );
    const promosDisponibles: CartPromoDisponible[] = promosVisibles(promos, [canal]).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        badge: promoTipoBadge(p.tipo, p.valor),
        condicion: promoCondicionResumen(p) || undefined,
    }));

    const onConfirm = async () => {
        const res = await enviar.mutateAsync();
        if (res.success) {
            // Pedir ≠ pagar: el pedido va a la cocina; el comensal paga cuando quiera con "Pagar".
            toast.success('¡Pedido enviado! Podés seguir pidiendo o tocar "Pagar" cuando quieras.');
            return { success: true };
        }
        return { success: false, message: res.message ?? 'Error al enviar' };
    };

    return (
        <MenuView
            categorias={categorias}
            productos={productos}
            cart={cart}
            pedidosConfirmados={pedidosConfirmados}
            onLlamarMozo={
                modo === 'mesa' ? () => llamarMozoAction(tenantId, mesaIdentificador) : undefined
            }
            mostrarPagar
            autoAbrirPago={autoAbrirPago}
            renderPagoModal={({ open, onClose }) => (
                <PaymentMethodModal
                    isOpen={open}
                    onClose={onClose}
                    sesionMesaId={sesionMesaId}
                    tenantId={tenantId}
                    metodosPago={metodosPago}
                    externo={modo === 'externo'}
                />
            )}
            confirmLabel="Confirmar Pedido"
            onConfirm={onConfirm}
            confirming={enviar.isPending}
            drawerTitulo={modo === 'externo' ? 'Tu pedido' : 'Resumen de tu Mesa'}
            promosDisponibles={promosDisponibles}
            promoResumen={preview}
        />
    );
}
