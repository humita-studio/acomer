'use client';

import { useState } from 'react';
import { useComandaStore } from '../store';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { llamarMozoAction } from '../sesion-mesa-actions';
import { PaymentMethodModal } from '../../pagos/components/PaymentMethodModal';
import type { MetodoPago } from '../../pagos/get-metodos-pago';

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

type MenuDigitalProps = {
    tenantId: string;
    sesionMesaId: string;
    mesaIdentificador: string;
    categorias: CategoriaMenu[];
    productos: ProductoMenu[];
    metodosPago: MetodoPago[];
    pedidosConfirmados?: any[];
};

export function MenuDigital({ tenantId, sesionMesaId, mesaIdentificador, categorias, productos, metodosPago, pedidosConfirmados = [] }: MenuDigitalProps) {
    const [activeCategory, setActiveCategory] = useState<string>(categorias[0]?.id || '');
    const [selectedProduct, setSelectedProduct] = useState<ProductoMenu | null>(null);
    const [isCalling, setIsCalling] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const activeProducts = productos.filter((p) => p.categoriaId === activeCategory);

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

    const handlePedirCuentaClick = () => {
        setShowPaymentModal(true);
    };

    return (
        <div className="pb-24 max-w-2xl mx-auto w-full relative min-h-screen bg-gray-50">
            {/* Category Tabs & Actions */}
            <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="p-4 flex justify-between items-center bg-gray-50 border-b">
                    <span className="font-semibold text-gray-700">Acciones rápidas:</span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleLlamarMozo}
                            disabled={isCalling}
                            className="text-sm bg-orange-100 text-orange-700 hover:bg-orange-200 px-4 py-2 rounded-full font-medium transition-colors disabled:opacity-50"
                        >
                            {isCalling ? 'Llamando...' : 'Mozo'}
                        </button>
                        <button
                            onClick={handlePedirCuentaClick}
                            className="text-sm bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-full font-medium transition-colors transition-opacity"
                        >
                            Pedir Cuenta
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto whitespace-nowrap p-4">
                    <div className="flex gap-4">
                        {categorias.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-4 py-2 rounded-full font-medium transition-colors ${activeCategory === cat.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {cat.nombre}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product List */}
                <div className="p-4 space-y-4">
                    {activeProducts.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">No hay productos en esta categoría.</p>
                    ) : (
                        activeProducts.map((prod) => (
                            <div
                                key={prod.id}
                                onClick={() => setSelectedProduct(prod)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-300 transition-all flex justify-between items-center"
                            >
                                <div>
                                    <h3 className="font-semibold text-lg text-gray-800">{prod.nombre}</h3>
                                    {prod.descripcion && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{prod.descripcion}</p>}
                                    <p className="font-bold text-blue-600 mt-2">${prod.precio.toFixed(2)}</p>
                                </div>
                                <div className="bg-blue-50 p-2 rounded-full text-blue-600 shrink-0 ml-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Product Modal */}
                {selectedProduct && (
                    <ProductModal
                        product={selectedProduct}
                        sesionMesaId={sesionMesaId}
                        tenantId={tenantId}
                        onClose={() => setSelectedProduct(null)}
                    />
                )}

                {/* Floating Cart */}
                <FloatingCart 
                  tenantId={tenantId} 
                  sesionMesaId={sesionMesaId} 
                  metodosPago={metodosPago} 
                  pedidosConfirmados={pedidosConfirmados}
                />
                
                {/* Modal de Pago desde el header */}
                <PaymentMethodModal
                  isOpen={showPaymentModal}
                  onClose={() => setShowPaymentModal(false)}
                  sesionMesaId={sesionMesaId}
                  tenantId={tenantId}
                  metodosPago={metodosPago}
                />
            </div>
        </div>
    );
}
