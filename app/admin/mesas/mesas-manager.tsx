'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { crearMesa, eliminarMesa, liberarMesaAction } from '@/features/mesas/mesas-actions';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';

export function MesasManager({ mesas, origin, userRole, tenantId }: { mesas: any[], origin: string, userRole: string, tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [liberandoId, setLiberandoId] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<{ id: string; texto: string }[]>([]);

  // Escuchar alertas de las mesas (llamar mozo / pedir cuenta) en tiempo real
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);

    const pushAviso = (texto: string) => {
      const id = crypto.randomUUID();
      setAvisos((prev) => [{ id, texto }, ...prev].slice(0, 5));
      setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), 20000);
    };

    channel
      .on('broadcast', { event: 'alerta_mesa' }, ({ payload }) => {
        pushAviso(`🔔 ${payload?.mesaIdentificador || 'Una mesa'} está llamando al mozo`);
      })
      .on('broadcast', { event: 'cuenta_solicitada' }, () => {
        pushAviso('💵 Una mesa pidió la cuenta — revisá Cobros');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const handleCrearMesa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const identificador = formData.get('identificador') as string;
    setLoading(true);
    await crearMesa(identificador);
    setLoading(false);
    e.currentTarget.reset();
  };

  const handleLiberarMesa = async (mesaId: string, identificador: string) => {
    if (!confirm(`¿Estás seguro de liberar la ${identificador}? Esto cerrará la sesión actual.`)) return;
    setLiberandoId(mesaId);
    await liberarMesaAction(mesaId);
    setLiberandoId(null);
  };

  const canManage = userRole === 'owner' || userRole === 'admin';
  const canTakeOrders = hasPermission(userRole as RoleType, 'canTakeOrders');

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {avisos.length > 0 && (
        <div className="mb-6 space-y-2">
          {avisos.map((a) => (
            <div key={a.id} className="flex justify-between items-center bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <span>{a.texto}</span>
              <button onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))} className="text-amber-500 hover:text-amber-700 ml-3">✕</button>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form onSubmit={handleCrearMesa} className="flex gap-4 mb-8">
          <input 
            name="identificador" 
            placeholder="Identificador (ej: Mesa 1, Barra A)" 
            required 
            className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" 
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Guardando...' : 'Añadir Mesa'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mesas.map((mesa) => {
          // El subdominio ya viene incluido en el origin (ej: http://pizzeria.localhost:3000)
          const url = `${origin}/mesa/${mesa.qrToken}`;

          return (
            <div key={mesa.id} className={`border-2 rounded-lg p-6 flex flex-col items-center hover:shadow-md transition relative ${mesa.ocupada ? 'border-orange-300 bg-orange-50/30' : 'border-gray-100'}`}>
              
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${mesa.ocupada ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {mesa.ocupada ? 'Ocupada' : 'Libre'}
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-4">{mesa.identificador}</h3>
              
              <div className="bg-white p-3 border-2 border-gray-100 rounded-xl mb-4 shadow-sm">
                <QRCodeSVG value={url} size={160} level="H" includeMargin={true} />
              </div>

              <div className="text-center w-full mb-4">
                <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block text-left">URL de la Comanda</label>
                <input 
                  type="text" 
                  readOnly 
                  value={url} 
                  className="w-full text-xs text-gray-600 bg-white border border-gray-200 rounded px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  onClick={(e) => {
                    e.currentTarget.select();
                    navigator.clipboard.writeText(url);
                  }}
                  title="Haz clic para copiar"
                />
              </div>

              <div className="flex gap-2 w-full mt-auto flex-wrap">
                {mesa.ocupada && canTakeOrders && (
                  <Link
                    href={`/admin/mesas/${mesa.id}`}
                    className="flex-1 min-w-[130px] text-center text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 py-2 rounded-md transition text-sm font-bold"
                  >
                    Ver / Agregar pedido
                  </Link>
                )}
                {mesa.ocupada && canManage && (
                  <button
                    onClick={() => handleLiberarMesa(mesa.id, mesa.identificador)}
                    disabled={liberandoId === mesa.id}
                    className="flex-1 text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 py-2 rounded-md transition text-sm font-bold disabled:opacity-50"
                  >
                    {liberandoId === mesa.id ? 'Liberando...' : 'Liberar Mesa'}
                  </button>
                )}

                {canManage && (
                  <button 
                    onClick={() => {
                      if(confirm(`¿Eliminar ${mesa.identificador}?`)) eliminarMesa(mesa.id);
                    }}
                    className={`text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 py-2 rounded-md transition text-sm font-medium ${mesa.ocupada ? 'px-4' : 'w-full'}`}
                    title="Eliminar Mesa"
                  >
                    {mesa.ocupada ? 'Eliminar' : 'Eliminar Mesa'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {mesas.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500">No hay mesas registradas en este momento.</p>
          {canManage && <p className="text-sm text-gray-400 mt-1">Usa el formulario de arriba para añadir la primera.</p>}
        </div>
      )}
    </div>
  );
}
