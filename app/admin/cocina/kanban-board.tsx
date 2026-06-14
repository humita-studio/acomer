'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { cambiarEstadoPedido } from '@/features/comanda/pedidos-actions';

export function KanbanBoard({ 
  initialPedidos, 
  restauranteId,
  userRole 
}: { 
  initialPedidos: any[], 
  restauranteId: string,
  userRole: string 
}) {
  const [pedidos, setPedidos] = useState(initialPedidos);
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  // Actualizar el estado si vienen nuevos props desde el servidor
  useEffect(() => {
    setPedidos(initialPedidos);
  }, [initialPedidos]);

  useEffect(() => {
    // Suscripción a cambios en la tabla pedidos usando Supabase Realtime
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pedidos',
          filter: `restaurant_id=eq.${restauranteId}`,
        },
        (payload) => {
          console.log('Cambio detectado en pedidos:', payload);
          // Refrescamos los datos desde el servidor para obtener los items actualizados.
          // Next.js RSC re-ejecutará el componente del servidor y pasará nuevos props.
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, restauranteId, router]);

  const movePedido = async (id: string, nuevoEstado: 'Pendiente' | 'En Preparación' | 'Listo' | 'Entregado') => {
    // Actualización optimista de la UI
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    const result = await cambiarEstadoPedido(id, nuevoEstado);
    
    // Si falla, volvemos al estado inicial pidiendo un refresh
    if (!result.success) {
      alert(result.message);
      router.refresh();
    }
  };

  const columnas = ['Pendiente', 'En Preparación', 'Listo'];

  return (
    <div className="flex-1 overflow-x-auto mt-4">
      <div className="flex gap-6 min-w-max h-full pb-8">
        {columnas.map(columna => {
          const pedidosColumna = pedidos.filter(p => p.estado === columna);

          return (
            <div key={columna} className="w-80 bg-gray-50 rounded-xl shadow-sm flex flex-col max-h-[80vh] border border-gray-200">
              <div className="p-4 bg-gray-100 border-b border-gray-200 rounded-t-xl font-bold text-gray-700 flex justify-between items-center">
                <span>{columna}</span>
                <span className="text-xs bg-gray-300 text-gray-800 px-2 py-1 rounded-full font-semibold">
                  {pedidosColumna.length}
                </span>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {pedidosColumna.map(pedido => (
                  <div key={pedido.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow transition relative group cursor-default">
                    <div className="flex justify-between items-start mb-3 border-b pb-2">
                      <span className="font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2 py-1 rounded text-sm shadow-sm">
                        Mesa {pedido.mesa}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(pedido.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <ul className="text-sm text-gray-700 space-y-2 mb-4">
                      {pedido.items.map((item: any) => (
                        <li key={item.id} className="flex items-start">
                          <span className="font-bold mr-2 text-gray-900 bg-gray-100 px-1.5 rounded">{item.cantidad}</span>
                          <span className="leading-tight">{item.nombre}</span>
                        </li>
                      ))}
                    </ul>

                    {pedido.notas && (
                      <p className="text-xs text-orange-800 bg-orange-50 border border-orange-100 p-2 rounded mb-4 italic">
                        📝 {pedido.notas}
                      </p>
                    )}

                    <div className="flex gap-2 mt-auto">
                      {columna === 'Pendiente' && (
                        <button 
                          onClick={() => movePedido(pedido.id, 'En Preparación')}
                          className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 transition font-medium"
                        >
                          Preparar
                        </button>
                      )}
                      {columna === 'En Preparación' && (
                        <button 
                          onClick={() => movePedido(pedido.id, 'Listo')}
                          className="flex-1 bg-green-600 text-white text-sm py-2 rounded-md hover:bg-green-700 transition font-medium"
                        >
                          Marcar Listo
                        </button>
                      )}
                      {columna === 'Listo' && (userRole === 'mozo' || userRole === 'owner' || userRole === 'admin') && (
                        <button 
                          onClick={() => movePedido(pedido.id, 'Entregado')}
                          className="flex-1 bg-gray-800 text-white text-sm py-2 rounded-md hover:bg-gray-900 transition font-medium"
                        >
                          Entregar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {pedidosColumna.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 h-32">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">Sin pedidos</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
