'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import {
    aprobarPagoPresencialAction,
    rechazarPagoPresencialAction,
    TransaccionCobro,
    getTransaccionesPendientesAction
} from '@/features/pagos/cobros-actions';

export function CobrosManager({
    initialTransacciones,
    tenantId
}: {
    initialTransacciones: TransaccionCobro[],
    tenantId: string
}) {
    const [transacciones, setTransacciones] = useState<TransaccionCobro[]>(initialTransacciones);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        // Escuchar nuevos cobros en tiempo real
        const channel = supabase.channel(`admin_restaurant_${tenantId}`);

        channel.on(
            'broadcast',
            { event: 'cuenta_solicitada' },
            (payload) => {
                // Alguien en una mesa pidió la cuenta, recargar la lista
                refreshTransacciones();
            }
        ).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, supabase]);

    const refreshTransacciones = async () => {
        const updated = await getTransaccionesPendientesAction(tenantId);
        setTransacciones(updated);
    };

    const handleAprobar = async (id: string) => {
        if (!confirm('¿Confirmas que recibiste el pago y quieres cerrar la mesa?')) return;

        setLoadingId(id);
        const res = await aprobarPagoPresencialAction(id, tenantId);
        if (res.success) {
            setTransacciones(prev => prev.filter(t => t.id !== id));
        } else {
            alert(res.message);
        }
        setLoadingId(null);
    };

    const handleRechazar = async (id: string) => {
        if (!confirm('¿Rechazar este pago? La mesa seguirá abierta.')) return;

        setLoadingId(id);
        const res = await rechazarPagoPresencialAction(id, tenantId);
        if (res.success) {
            setTransacciones(prev => prev.filter(t => t.id !== id));
        } else {
            alert(res.message);
        }
        setLoadingId(null);
    };

    if (transacciones.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow p-12 text-center border-2 border-dashed border-gray-200 mt-6">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                        <rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No hay cobros pendientes</h3>
                <p className="text-gray-500">Cuando una mesa pida pagar en efectivo o con tarjeta, aparecerá aquí.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
            {transacciones.map(tx => (
                <div key={tx.id} className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>

                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full">
                                    MESA {tx.mesaIdentificador}
                                </span>
                                <p className="text-sm text-gray-500 mt-2">
                                    {new Date(tx.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-xl">
                                {tx.proveedor === 'efectivo' ? '💵' : '💳'}
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-gray-500 font-medium">Quiere pagar con</p>
                            <p className="text-lg font-bold text-gray-900 capitalize">
                                {tx.proveedor === 'tarjeta_fisica' ? 'Tarjeta Física' : tx.proveedor}
                            </p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center mb-6">
                            <span className="text-gray-500 font-medium">Total a cobrar</span>
                            <span className="text-2xl font-black text-gray-900">${Number(tx.monto).toFixed(2)}</span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleAprobar(tx.id)}
                                disabled={loadingId !== null}
                                className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {loadingId === tx.id ? 'Aprobando...' : 'Aprobar Cobro'}
                            </button>
                            <button
                                onClick={() => handleRechazar(tx.id)}
                                disabled={loadingId !== null}
                                className="px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                                title="Rechazar y mantener mesa abierta"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
