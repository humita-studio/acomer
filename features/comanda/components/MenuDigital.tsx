'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { Button } from '@/shared/ui/button';
import { llamarMozoAction } from '../sesion-mesa-actions';
import { PaymentMethodModal } from '../../pagos/components/PaymentMethodModal';
import type { MetodoPago } from '../../pagos/get-metodos-pago';
import type { CartApi } from '../cart/use-cart';
import { useServerCart } from '../cart/use-cart';
import { useEnviarPedido } from '../use-borrador';

export type ModificadorMenu = {
    id: string;
    nombre: string;
    precioExtra: number;
};

export type ProductoMenu = {
    id: string;
    categoriaId: string;
    nombre: string;
    descripcion: string | null;
    precio: number;
    permiteAdicionales: boolean;
    modificadores: ModificadorMenu[];
};

export type CategoriaMenu = {
    id: string;
    nombre: string;
};

// ============================================================================
// MenuView: shell presentacional del menú. Agnóstico al origen del carrito
// (recibe un CartApi) y a cómo se confirma (onConfirm). Lo reusan tanto el
// flujo de sesión (MenuDigital) como el externo "menú primero" (MenuExterno).
// ============================================================================

type MenuViewProps = {
    tenantId: string;
    mesaIdentificador: string;
    categorias: CategoriaMenu[];
    productos: ProductoMenu[];
    cart: CartApi;
    pedidosConfirmados?: any[];
    showMozo?: boolean;
    // Datos de pago de la sesión; null = sin botón de pago (ej: menú-primero).
    // externo: pedido de retiro/envío (ajusta el copy del pago presencial).
    // autoAbrir: abrir el modal de pago apenas monta (viene del checkout externo).
    pago?: {
        sesionMesaId: string;
        metodosPago: MetodoPago[];
        externo?: boolean;
        autoAbrir?: boolean;
    } | null;
    confirmLabel: string;
    onConfirm: () => Promise<{ success: boolean; message?: string } | void>;
    confirming: boolean;
    drawerTitulo?: string;
};

export function MenuView({
    tenantId,
    mesaIdentificador,
    categorias,
    productos,
    cart,
    pedidosConfirmados = [],
    showMozo = false,
    pago = null,
    confirmLabel,
    onConfirm,
    confirming,
    drawerTitulo,
}: MenuViewProps) {
    const [activeCategory, setActiveCategory] = useState<string>(categorias[0]?.id || '');
    const [selectedProduct, setSelectedProduct] = useState<ProductoMenu | null>(null);
    const [isCalling, setIsCalling] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(pago?.autoAbrir ?? false);

    const activeProducts = productos.filter((p) => p.categoriaId === activeCategory);
    const showQuickActions = showMozo || !!pago;

    const handleLlamarMozo = async () => {
        setIsCalling(true);
        const res = await llamarMozoAction(tenantId, mesaIdentificador);
        if (res.success) {
            alert('¡Mozo notificado! En breve se acercará a la mesa.');
        } else {
            alert('Hubo un error al llamar al mozo.');
        }
        setIsCalling(false);
    };

    return (
        <div className="pb-24 max-w-2xl mx-auto w-full relative min-h-screen bg-muted/30">
            {/* Category Tabs & Actions */}
            <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
                {showQuickActions && (
                    <div className="p-4 flex justify-between items-center bg-muted/40 border-b">
                        <span className="font-semibold text-muted-foreground">Acciones rápidas:</span>
                        <div className="flex gap-2">
                            {showMozo && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    onClick={handleLlamarMozo}
                                    disabled={isCalling}
                                >
                                    {isCalling ? 'Llamando...' : 'Llamar al mozo'}
                                </Button>
                            )}
                            {pago && (
                                <Button
                                    size="sm"
                                    className="rounded-full"
                                    onClick={() => setShowPaymentModal(true)}
                                >
                                    Pagar
                                </Button>
                            )}
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto whitespace-nowrap p-4">
                    <div className="flex gap-2">
                        {categorias.map((cat) => (
                            <Button
                                key={cat.id}
                                variant={activeCategory === cat.id ? 'default' : 'secondary'}
                                size="sm"
                                className="rounded-full"
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.nombre}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Product List */}
                <div className="p-4 space-y-3">
                    {activeProducts.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No hay productos en esta categoría.</p>
                    ) : (
                        activeProducts.map((prod) => (
                            <button
                                key={prod.id}
                                type="button"
                                onClick={() => setSelectedProduct(prod)}
                                className="w-full text-left bg-card text-card-foreground p-4 rounded-xl shadow-sm border cursor-pointer hover:border-primary/40 hover:shadow-md transition-all flex justify-between items-center gap-4"
                            >
                                <div>
                                    <h3 className="font-semibold text-lg">{prod.nombre}</h3>
                                    {prod.descripcion && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{prod.descripcion}</p>}
                                    <p className="font-bold mt-2 tabular-nums">${prod.precio.toFixed(2)}</p>
                                </div>
                                <div className="bg-primary/10 text-primary p-2 rounded-full shrink-0">
                                    <Plus className="size-5" />
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Product Modal */}
                {selectedProduct && (
                    <ProductModal
                        product={selectedProduct}
                        cart={cart}
                        onClose={() => setSelectedProduct(null)}
                    />
                )}

                {/* Floating Cart */}
                <FloatingCart
                    cart={cart}
                    pedidosConfirmados={pedidosConfirmados}
                    confirmLabel={confirmLabel}
                    onConfirm={onConfirm}
                    confirming={confirming}
                    titulo={drawerTitulo}
                />

                {/* Modal de Pago desde el header (sólo cuando hay sesión) */}
                {pago && (
                    <PaymentMethodModal
                        isOpen={showPaymentModal}
                        onClose={() => setShowPaymentModal(false)}
                        sesionMesaId={pago.sesionMesaId}
                        tenantId={tenantId}
                        metodosPago={pago.metodosPago}
                        externo={pago.externo}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================================
// MenuDigital: wrapper con carrito server-side (borrador por sesión). Lo usan
// el salón (QR) y el externo con sesión (/pedir?sesion=). Firma estable.
// ============================================================================

type MenuDigitalProps = {
    tenantId: string;
    sesionMesaId: string;
    mesaIdentificador: string;
    categorias: CategoriaMenu[];
    productos: ProductoMenu[];
    metodosPago: MetodoPago[];
    initialItems: CartApi['items'];
    pedidosConfirmados?: any[];
    // 'mesa' (salón, con QR) | 'externo' (takeaway/delivery, sin mesa física)
    modo?: 'mesa' | 'externo';
    // Abrir el pago al montar (viene del checkout externo con pagar=1).
    autoAbrirPago?: boolean;
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
}: MenuDigitalProps) {
    const cart = useServerCart(tenantId, sesionMesaId, initialItems);
    const enviar = useEnviarPedido(tenantId, sesionMesaId);

    const onConfirm = async () => {
        const res = await enviar.mutateAsync();
        if (res.success) {
            // Pedir ≠ pagar: el pedido va a la cocina; el comensal paga cuando quiera con "Pagar".
            alert('¡Pedido enviado! Podés seguir pidiendo o tocar "Pagar" cuando quieras.');
            return { success: true };
        }
        return { success: false, message: res.message ?? 'Error al enviar' };
    };

    return (
        <MenuView
            tenantId={tenantId}
            mesaIdentificador={mesaIdentificador}
            categorias={categorias}
            productos={productos}
            cart={cart}
            pedidosConfirmados={pedidosConfirmados}
            showMozo={modo === 'mesa'}
            pago={{
                sesionMesaId,
                metodosPago,
                externo: modo === 'externo',
                autoAbrir: autoAbrirPago,
            }}
            confirmLabel="Confirmar Pedido"
            onConfirm={onConfirm}
            confirming={enviar.isPending}
            drawerTitulo={modo === 'externo' ? 'Tu pedido' : 'Resumen de tu Mesa'}
        />
    );
}
