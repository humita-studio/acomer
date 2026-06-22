'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { Button } from '@/shared/ui/button';
import type { CategoriaMenu, ProductoMenu } from '../types';
import type { CartApi, PedidoConfirmadoResumen } from '../cart';

// ============================================================================
// MenuView: shell presentacional del menú. Agnóstico al origen del carrito
// (recibe un CartApi), a cómo se confirma (onConfirm) y a las acciones de
// sesión/pago (se inyectan: onLlamarMozo + renderPagoModal). Lo reusan tanto el
// flujo de sesión (MenuDigital, en comanda) como el externo (MenuExterno).
// ============================================================================

type MenuViewProps = {
    categorias: CategoriaMenu[];
    productos: ProductoMenu[];
    cart: CartApi;
    pedidosConfirmados?: PedidoConfirmadoResumen[];
    /** Si se provee, muestra el botón "Llamar al mozo" y delega la acción. */
    onLlamarMozo?: () => Promise<{ success: boolean }>;
    /** Muestra el botón "Pagar". El modal en sí lo provee `renderPagoModal`. */
    mostrarPagar?: boolean;
    /** Abrir el modal de pago apenas monta (viene del checkout externo). */
    autoAbrirPago?: boolean;
    /** Modal de pago inyectado por el caller (mantiene a carta desacoplado de pagos). */
    renderPagoModal?: (args: { open: boolean; onClose: () => void }) => ReactNode;
    confirmLabel: string;
    onConfirm: () => Promise<{ success: boolean; message?: string } | void>;
    confirming: boolean;
    drawerTitulo?: string;
};

export function MenuView({
    categorias,
    productos,
    cart,
    pedidosConfirmados = [],
    onLlamarMozo,
    mostrarPagar = false,
    autoAbrirPago = false,
    renderPagoModal,
    confirmLabel,
    onConfirm,
    confirming,
    drawerTitulo,
}: MenuViewProps) {
    const [activeCategory, setActiveCategory] = useState<string>(categorias[0]?.id || '');
    const [selectedProduct, setSelectedProduct] = useState<ProductoMenu | null>(null);
    const [isCalling, setIsCalling] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(autoAbrirPago);

    const activeProducts = productos.filter((p) => p.categoriaId === activeCategory);
    const showQuickActions = !!onLlamarMozo || mostrarPagar;

    const handleLlamarMozo = async () => {
        if (!onLlamarMozo) return;
        setIsCalling(true);
        const res = await onLlamarMozo();
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
                            {onLlamarMozo && (
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
                            {mostrarPagar && (
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
                                    <p className="font-bold mt-2 tabular-nums">
                                        {prod.variantes.length > 0 && <span className="font-normal text-muted-foreground">desde </span>}
                                        ${prod.precio.toFixed(2)}
                                    </p>
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

                {/* Modal de pago inyectado por el caller (sólo cuando hay sesión) */}
                {renderPagoModal?.({
                    open: showPaymentModal,
                    onClose: () => setShowPaymentModal(false),
                })}
            </div>
        </div>
    );
}
