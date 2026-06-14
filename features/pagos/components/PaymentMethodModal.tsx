'use client';

import { useState } from 'react';
import type { MetodoPago } from '../get-metodos-pago';
import { pedirCuentaAction } from '../pagos-actions';
import { pedirCuentaPresencialAction } from '../pago-presencial-action';

type PaymentMethodModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sesionMesaId: string;
  tenantId: string;
  metodosPago: MetodoPago[];
};

export function PaymentMethodModal({
  isOpen,
  onClose,
  sesionMesaId,
  tenantId,
  metodosPago,
}: PaymentMethodModalProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSelectMethod = async (metodo: MetodoPago) => {
    setProcessing(metodo.id);
    setResult(null);

    try {
      if (metodo.id === 'mercado_pago') {
        // Pago digital — redirige a MP checkout
        const currentUrl = window.location.href;
        const res = await pedirCuentaAction(sesionMesaId, tenantId, currentUrl);

        if (res.success && res.paymentUrl) {
          window.location.href = res.paymentUrl;
          return; // No reset processing — estamos redirigiendo
        } else {
          setResult({ success: false, message: res.message || 'Error al iniciar el pago con Mercado Pago.' });
        }
      } else {
        // Pago presencial (efectivo o tarjeta física)
        const res = await pedirCuentaPresencialAction(
          sesionMesaId,
          tenantId,
          metodo.id as 'efectivo' | 'tarjeta_fisica'
        );

        if (res.success && res.transactionId) {
          const baseUrl = window.location.href.split('?')[0];
          window.location.href = `${baseUrl}?pago=pendiente&tx=${res.transactionId}`;
          return; // No reset processing, we are redirecting
        } else {
          setResult({ success: false, message: res.message });
        }
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Error inesperado.' });
    } finally {
      setProcessing(null);
    }
  };

  // Si ya se pidió cuenta presencial exitosamente, mostrar confirmación
  if (result?.success) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
        <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl p-6 shadow-xl animate-in slide-in-from-bottom-10">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">¡Cuenta solicitada!</h3>
            <p className="text-gray-600 text-sm">{result.message}</p>
            <button
              onClick={() => {
                setResult(null);
                onClose();
              }}
              className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl animate-in slide-in-from-bottom-10 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="font-bold text-xl text-gray-900">¿Cómo querés pagar?</h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Payment Methods */}
        <div className="p-5 space-y-3">
          {metodosPago.map((metodo) => {
            const isProcessing = processing === metodo.id;
            const isDisabled = processing !== null;

            return (
              <button
                key={metodo.id}
                onClick={() => handleSelectMethod(metodo)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                  ${isProcessing
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'
                  }
                  ${isDisabled && !isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
                  {metodo.icono}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{metodo.nombre}</h3>
                  <p className="text-sm text-gray-500">
                    {metodo.tipo === 'digital' ? 'Pago online' : 'Pago en la mesa'}
                  </p>
                </div>
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {result && !result.success && (
          <div className="px-5 pb-4">
            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-medium">
              {result.message}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="p-5 pt-0">
          <p className="text-xs text-gray-400 text-center">
            También podés cerrar este menú y pagar después.
          </p>
        </div>
      </div>
    </div>
  );
}
