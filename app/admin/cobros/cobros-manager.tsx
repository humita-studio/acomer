'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
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
    const queryClient = useQueryClient();

    // Estado de servidor: la lista de cobros pendientes. `initialData` aprovecha
    // el fetch que ya hizo el Server Component (page.tsx), sin refetch al montar.
    const { data: transacciones = [] } = useQuery({
        queryKey: queryKeys.cobros(tenantId),
        queryFn: () => getTransaccionesPendientesAction(tenantId),
        initialData: initialTransacciones,
    });

    // Realtime: cuando una mesa pide la cuenta, invalidamos la query en vez de
    // recargar la lista a mano.
    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        const channel = supabase.channel(`admin_restaurant_${tenantId}`);

        channel
            .on('broadcast', { event: 'cuenta_solicitada' }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, queryClient]);

    const aprobarMutation = useMutation({
        mutationFn: (id: string) => aprobarPagoPresencialAction(id, tenantId),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
            } else {
                alert(res.message);
            }
        },
    });

    const rechazarMutation = useMutation({
        mutationFn: (id: string) => rechazarPagoPresencialAction(id, tenantId),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries({ queryKey: queryKeys.cobros(tenantId) });
            } else {
                alert(res.message);
            }
        },
    });

    const procesando = aprobarMutation.isPending || rechazarMutation.isPending;

    const handleAprobar = (id: string) => {
        if (!confirm('¿Confirmas que recibiste el pago y quieres cerrar la mesa?')) return;
        aprobarMutation.mutate(id);
    };

    const handleRechazar = (id: string) => {
        if (!confirm('¿Rechazar este pago? La mesa seguirá abierta.')) return;
        rechazarMutation.mutate(id);
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
            {transacciones.map(tx => {
                const aprobandoEsta = aprobarMutation.isPending && aprobarMutation.variables === tx.id;
                return (
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

                            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                                {Number(tx.descuento) > 0 && (
                                    <div className="flex justify-between items-center text-sm mb-2 text-emerald-700">
                                        <span className="font-medium">Descuento aplicado</span>
                                        <span className="font-semibold">− ${Number(tx.descuento).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Total a cobrar</span>
                                    <span className="text-2xl font-black text-gray-900">${Number(tx.monto).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleAprobar(tx.id)}
                                    disabled={procesando}
                                    className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {aprobandoEsta ? 'Aprobando...' : 'Aprobar Cobro'}
                                </button>
                                <button
                                    onClick={() => handleRechazar(tx.id)}
                                    disabled={procesando}
                                    className="px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                                    title="Rechazar y mantener mesa abierta"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
