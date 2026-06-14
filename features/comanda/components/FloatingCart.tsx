'use client';

import { useState } from 'react';
import { useComandaStore } from '../store';
import { enviarPedidoAction } from '../enviar-pedido-actions';
import { eliminarItemBorrador, actualizarCantidadBorrador } from '../borrador-actions';
import { PaymentMethodModal } from '../../pagos/components/PaymentMethodModal';
import type { MetodoPago } from '../../pagos/get-metodos-pago';

type FloatingCartProps = {
  tenantId: string;
  sesionMesaId: string;
  metodosPago: MetodoPago[];
  pedidosConfirmados?: any[];
};

export function FloatingCart({ tenantId, sesionMesaId, metodosPago, pedidosConfirmados = [] }: FloatingCartProps) {
  const { items, getTotal, optimisticRemove, optimisticUpdateQuantity } = useComandaStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Consideramo si el carrito está vacío y no hay pedidos confirmados
  if (items.length === 0 && pedidosConfirmados.length === 0 && !showPaymentModal) return null;

  const totalBorrador = getTotal();
  const totalItemsBorrador = items.reduce((sum, item) => sum + item.cantidad, 0);

  const totalConfirmado = pedidosConfirmados.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItemsConfirmado = pedidosConfirmados.reduce((sum, item) => sum + item.cantidad, 0);

  const granTotal = totalBorrador + totalConfirmado;
  const totalItemsGeneral = totalItemsBorrador + totalItemsConfirmado;

  const broadcastChange = () => {
    const fn = useComandaStore.getState()._broadcastChange;
    if (fn) fn();
  };

  const handleRemoveItem = async (itemId: string) => {
    optimisticRemove(itemId);
    await eliminarItemBorrador(itemId, tenantId);
    broadcastChange();
  };

  const handleUpdateQuantity = async (itemId: string, currentQuantity: number, delta: number) => {
    const newQuantity = Math.max(1, currentQuantity + delta);
    optimisticUpdateQuantity(itemId, newQuantity);
    await actualizarCantidadBorrador(itemId, tenantId, newQuantity);
    broadcastChange();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await enviarPedidoAction(tenantId, sesionMesaId);
      
      if (res.success) {
        useComandaStore.getState().clearCart();
        setIsOpen(false);
        broadcastChange();
        // Abrir modal de pagos y luego recargar
        setShowPaymentModal(true);
      } else {
        setError(res.message);
      }
    } catch (e: any) {
      setError(e.message || 'Error al enviar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Botón flotante siempre visible cuando hay items pero el cart está cerrado */}
      {!isOpen && (items.length > 0 || pedidosConfirmados.length > 0) && !showPaymentModal && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-40 animate-in slide-in-from-bottom-10 fade-in">
          <div className="max-w-2xl mx-auto">
            <button 
              onClick={() => setIsOpen(true)}
              className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-blue-200 flex justify-between items-center hover:bg-blue-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                  {totalItemsGeneral}
                </div>
                <span>Ver Pedido</span>
              </div>
              <span className="text-lg">${granTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl flex flex-col shadow-xl animate-in slide-in-from-bottom-10">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-xl flex items-center gap-2">
                Resumen de tu Mesa
                <span className="bg-gray-100 text-gray-600 text-sm py-1 px-2 rounded-full font-medium">
                  {totalItemsGeneral} items
                </span>
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* Pedidos Confirmados */}
              {pedidosConfirmados.length > 0 && (
                <div>
                  <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2 border-b pb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    En preparación
                  </h3>
                  <div className="space-y-3 opacity-80">
                    {pedidosConfirmados.map((item, idx) => (
                      <div key={idx} className="flex flex-col border-b border-gray-100 pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-800">{item.cantidad}x {item.nombre}</h4>
                            {item.modificadores.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                + {item.modificadores.map((m: any) => m.nombre).join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-gray-700">${item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Borrador / Nuevos Items */}
              {items.length > 0 && (
                <div>
                  <h3 className="font-bold text-blue-700 mb-3 flex items-center gap-2 border-b pb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    Por confirmar
                  </h3>
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col border-b pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{item.nombre}</h4>
                            {item.modificadores.length > 0 && (
                              <p className="text-sm text-gray-500 mt-1">
                                + {item.modificadores.map(m => m.nombre).join(', ')}
                              </p>
                            )}
                            <p className="text-blue-600 font-medium mt-1">
                              ${((item.precioUnitario + item.modificadores.reduce((s,m)=>s+m.precioExtra,0)) * item.cantidad).toFixed(2)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-full border">
                            <button 
                              onClick={() => handleUpdateQuantity(item.id, item.cantidad, -1)}
                              className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm"
                            >
                              -
                            </button>
                            <span className="font-medium w-4 text-center">{item.cantidad}</span>
                            <button 
                              onClick={() => handleUpdateQuantity(item.id, item.cantidad, 1)}
                              className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-500 text-sm font-medium self-start mt-2 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium">
                    {error}
                  </div>
                )}
                <div className="flex justify-between items-center mb-4 text-lg font-bold">
                  <span>A Enviar Ahora</span>
                  <span>${totalBorrador.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl transition-colors shadow-md shadow-blue-200"
                >
                  {isSubmitting ? 'Enviando...' : 'Confirmar Pedido'}
                </button>
              </div>
            )}
            
            {items.length === 0 && pedidosConfirmados.length > 0 && (
               <div className="p-4 border-t bg-gray-50 rounded-b-2xl text-center text-sm text-gray-500">
                  Todo tu pedido ya fue enviado a cocina.
               </div>
            )}

          </div>
        </div>
      )}

      {/* Modal de Pago post-confirmación */}
      <PaymentMethodModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          window.location.reload();
        }}
        sesionMesaId={sesionMesaId}
        tenantId={tenantId}
        metodosPago={metodosPago}
      />
    </>
  );
}
