'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import type { TicketData } from '../obtener-ticket-action';

type ResumenPagoProps = {
  ticket: TicketData;
};

export function ResumenPago({ ticket }: ResumenPagoProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ticket.transaccion.estado !== 'Pendiente' && ticket.transaccion.estado !== 'Cancelado') return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`tx_${ticket.transaccion.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transacciones_pago',
          filter: `id=eq.${ticket.transaccion.id}`
        },
        (payload) => {
          if (payload.new) {
            const hasStateChanged = payload.new.estado !== 'Pendiente';
            const hasAmountChanged = payload.new.monto !== ticket.transaccion.monto;
            
            if (hasStateChanged || hasAmountChanged) {
              console.log('Transaction updated:', payload.new);
              router.refresh(); // Refresh to get the new state or amount from server
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.transaccion.id, ticket.transaccion.estado, ticket.transaccion.monto, router]);

  const handleVolver = () => {
    // Al limpiar los searchParams, se recarga la página de la mesa,
    // y si la sesión anterior fue cerrada (por el pago),
    // el middleware/serverAction creará una nueva sesión limpia.
    router.replace(pathname);
  };

  const getMetodoLabel = (proveedor: string) => {
    switch (proveedor) {
      case 'mercado_pago': return 'Mercado Pago';
      case 'efectivo': return 'Efectivo';
      case 'tarjeta_fisica': return 'Tarjeta (Presencial)';
      default: return proveedor;
    }
  };

  const isApproved = ticket.transaccion.estado === 'Aprobado';
  const isPending = ticket.transaccion.estado === 'Pendiente';
  const isCanceled = ticket.transaccion.estado === 'Cancelado';

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex flex-col items-center justify-start pb-24">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-10 fade-in">
        
        {/* Header (Ticket Top) */}
        <div className={`p-8 text-center text-white ${isApproved ? 'bg-green-600' : isPending ? 'bg-orange-500' : isCanceled ? 'bg-red-500' : 'bg-gray-800'}`}>
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
            {isApproved ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : isPending ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            ) : isCanceled ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-1">
            {isApproved ? '¡Pago Exitoso!' : isPending ? 'Pago Pendiente' : isCanceled ? 'Link Expirado' : 'Ticket de Pago'}
          </h1>
          <p className="text-white/80 font-medium">Mesa {ticket.mesaIdentificador}</p>
        </div>

        {/* Decorative ZigZag */}
        <div className="w-full h-3 bg-repeat-x flex items-center justify-between opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 3px, transparent 4px)', backgroundSize: '12px 12px' }}></div>

        {/* Ticket Details */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex justify-between items-center text-sm border-b pb-4">
            <span className="text-gray-500">Método de pago</span>
            <span className="font-semibold text-gray-900">{getMetodoLabel(ticket.transaccion.proveedor)}</span>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Tu Pedido</h3>
            
            <div className="space-y-3">
              {ticket.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <div>
                      <span className="font-medium text-gray-900">
                        {item.cantidad}x {item.nombre}
                      </span>
                      {item.cantidad > 1 && (
                        <span className="text-gray-500 text-xs ml-2 font-normal">
                          (${(item.subtotal / item.cantidad).toFixed(2)} c/u)
                        </span>
                      )}
                    </div>
                    {item.modificadores.length > 0 && (
                      <div className="text-gray-500 text-xs mt-0.5 ml-4">
                        {item.modificadores.map(m => `+ ${m.nombre}`).join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900 ml-4">
                    ${item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t border-dashed border-gray-300 pt-4 mt-6">
            {ticket.totalPagado && ticket.totalPagado > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Total de la mesa</span>
                  <span className="font-semibold text-gray-900">${(ticket.saldoPendiente || 0) + ticket.totalPagado}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Pagos previos aprobados</span>
                  <span>- ${ticket.totalPagado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-gray-500 text-lg">RESTANTE</span>
                  <span className="font-black text-3xl text-gray-900">
                    ${ticket.saldoPendiente?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {ticket.transaccion.descuento > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-900 tabular-nums">
                        ${(ticket.transaccion.monto + ticket.transaccion.descuento).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Descuento</span>
                      <span className="tabular-nums">−${ticket.transaccion.descuento.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-gray-500 text-lg">TOTAL</span>
                  <span className="font-black text-3xl text-gray-900 tabular-nums">
                    ${ticket.transaccion.monto.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {isPending && ticket.transaccion.proveedor !== 'mercado_pago' && (
              <p className="text-center text-orange-600 bg-orange-50 p-3 rounded-lg text-sm font-medium mt-6">
                Un mozo se está acercando a tu mesa para realizar el cobro.
              </p>
            )}
            {isCanceled && (
              <p className="text-center text-red-600 bg-red-50 p-3 rounded-lg text-sm font-medium mt-6">
                Este link de pago ha expirado porque se agregaron nuevos platos a la mesa. Por favor, generá uno nuevo.
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 bg-gray-50 border-t">
          <button
            onClick={handleVolver}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            Volver a la Carta
          </button>
        </div>

      </div>
    </div>
  );
}
