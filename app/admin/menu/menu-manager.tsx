'use client';

import { useState } from 'react';
import { crearCategoria, eliminarCategoria } from '@/features/menu/categorias-actions';
import { crearProducto, modificarPrecioProducto, eliminarProducto } from '@/features/menu/productos-actions';
import type { RoleType } from '@/features/authorization/roles';

export function MenuManager({ 
  categorias, 
  productos, 
  userRole 
}: { 
  categorias: any[], 
  productos: any[], 
  userRole: string 
}) {
  const [activeTab, setActiveTab] = useState<'categorias' | 'productos'>('categorias');
  const [loading, setLoading] = useState(false);

  const handleCrearCategoria = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nombre = formData.get('nombre') as string;
    setLoading(true);
    await crearCategoria(nombre);
    setLoading(false);
    e.currentTarget.reset();
  };

  const handleCrearProducto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    await crearProducto({
      categoriaId: formData.get('categoriaId') as string,
      nombre: formData.get('nombre') as string,
      descripcion: formData.get('descripcion') as string,
      precio: Number(formData.get('precio')),
    });
    setLoading(false);
    e.currentTarget.reset();
  };

  const canManage = userRole === 'owner' || userRole === 'admin';
  const canManagePrices = userRole === 'owner' || userRole === 'admin';

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        <button
          className={`flex-1 py-4 font-medium text-center transition ${
            activeTab === 'categorias' 
              ? 'border-b-2 border-blue-600 text-blue-600 bg-white' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('categorias')}
        >
          Categorías
        </button>
        <button
          className={`flex-1 py-4 font-medium text-center transition ${
            activeTab === 'productos' 
              ? 'border-b-2 border-blue-600 text-blue-600 bg-white' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('productos')}
        >
          Productos y Precios
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'categorias' && (
          <div className="space-y-6">
            {canManage && (
              <form onSubmit={handleCrearCategoria} className="flex gap-4">
                <input 
                  name="nombre" 
                  placeholder="Nombre de la nueva categoría (ej: Bebidas)" 
                  required 
                  className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                />
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Añadir'}
                </button>
              </form>
            )}
            
            <div className="bg-white border rounded-md">
              {categorias.length === 0 ? (
                <p className="p-4 text-gray-500 text-center">No hay categorías registradas.</p>
              ) : (
                <ul className="divide-y">
                  {categorias.map((c) => (
                    <li key={c.id} className="flex justify-between items-center p-4 hover:bg-gray-50">
                      <span className="font-medium text-gray-800">{c.nombre}</span>
                      {canManage && (
                        <button 
                          onClick={() => {
                            if(confirm(`¿Eliminar la categoría ${c.nombre}?`)) eliminarCategoria(c.id);
                          }} 
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Eliminar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'productos' && (
          <div className="space-y-6">
            {canManage && (
              <form onSubmit={handleCrearProducto} className="bg-gray-50 p-4 rounded-md border grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <select name="categoriaId" required className="w-full px-3 py-2 border rounded-md bg-white">
                    <option value="">Categoría...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <input name="nombre" placeholder="Nombre del plato" required className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div className="md:col-span-3">
                  <input name="descripcion" placeholder="Descripción breve" className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div className="md:col-span-2">
                  <input name="precio" type="number" step="0.01" min="0" placeholder="Precio ($)" required className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div className="md:col-span-1">
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {loading ? '...' : '+'}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 gap-4">
              {productos.length === 0 ? (
                <p className="p-4 text-gray-500 text-center border rounded-md">No hay productos registrados.</p>
              ) : (
                productos.map((p) => {
                  const categoria = categorias.find(c => c.id === p.categoriaId);
                  return (
                    <div key={p.id} className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-md hover:border-blue-200 transition">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg text-gray-800">{p.nombre}</h3>
                          <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                            {categoria?.nombre || 'Sin categoría'}
                          </span>
                        </div>
                        {p.descripcion && <p className="text-sm text-gray-500 mt-1">{p.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-4 mt-4 md:mt-0 w-full md:w-auto md:justify-end">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Precio Actual</p>
                          <p className="font-bold text-xl text-gray-900">${Number(p.precio).toLocaleString('es-AR')}</p>
                        </div>
                        {canManagePrices && (
                          <button 
                            onClick={() => {
                              const newPrice = prompt(`Ingresa el nuevo precio para ${p.nombre}. El precio actual es $${p.precio}.`);
                              if (newPrice && !isNaN(Number(newPrice)) && Number(newPrice) > 0) {
                                modificarPrecioProducto(p.id, Number(newPrice));
                              }
                            }}
                            className="bg-white text-sm text-blue-600 border border-blue-600 px-4 py-2 rounded-md hover:bg-blue-50 transition shadow-sm font-medium whitespace-nowrap"
                          >
                            Modificar
                          </button>
                        )}
                        {canManage && (
                          <button 
                            onClick={() => {
                              if(confirm(`¿Eliminar producto ${p.nombre}?`)) eliminarProducto(p.id);
                            }} 
                            className="text-red-400 hover:text-red-600 p-2"
                            title="Eliminar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
