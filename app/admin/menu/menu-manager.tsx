'use client';

import { useMemo, useState } from 'react';
import {
  useVariantes,
  useAgregarVariante,
  useEditarPrecioVariante,
  useEliminarVariante,
  type Variante,
} from '@/features/menu/use-variantes';
import {
  useCategorias,
  useCrearCategoria,
  useEliminarCategoria,
  useProductos,
  useCrearProducto,
  useModificarPrecioProducto,
  useEliminarProducto,
  type CategoriaMenu,
  type ProductoMenu,
} from '@/features/menu/use-menu';

export function MenuManager({
  categorias: initialCategorias = [],
  productos: initialProductos = [],
  variantes: initialVariantes = [],
  userRole,
}: {
  categorias?: CategoriaMenu[],
  productos?: ProductoMenu[],
  variantes?: Variante[],
  userRole: string,
}) {
  const [activeTab, setActiveTab] = useState<'categorias' | 'productos'>('categorias');
  // Qué tarjetas de producto tienen abierto el panel de variantes
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Estado de servidor (TanStack Query) con updates optimistas
  const { data: categorias = [] } = useCategorias(initialCategorias);
  const { data: productos = [] } = useProductos(initialProductos);
  const { data: variantes = [] } = useVariantes(initialVariantes);
  const crearCategoriaMut = useCrearCategoria();
  const eliminarCategoriaMut = useEliminarCategoria();
  const crearProductoMut = useCrearProducto();
  const modificarPrecioMut = useModificarPrecioProducto();
  const eliminarProductoMut = useEliminarProducto();
  const agregarVariante = useAgregarVariante();
  const editarPrecio = useEditarPrecioVariante();
  const eliminarVariante = useEliminarVariante();

  // Variantes agrupadas por plato
  const variantesPorProducto = useMemo(() => {
    const map = new Map<string, Variante[]>();
    for (const v of variantes) {
      const arr = map.get(v.productoId) ?? [];
      arr.push(v);
      map.set(v.productoId, arr);
    }
    return map;
  }, [variantes]);

  const handleCrearCategoria = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const nombre = (new FormData(form).get('nombre') as string)?.trim();
    if (!nombre) return;
    crearCategoriaMut.mutate(nombre);
    form.reset();
  };

  const handleCrearProducto = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    crearProductoMut.mutate({
      categoriaId: formData.get('categoriaId') as string,
      nombre: formData.get('nombre') as string,
      descripcion: formData.get('descripcion') as string,
      precio: Number(formData.get('precio')),
    });
    form.reset();
  };

  const handleAgregarVariante = (e: React.FormEvent<HTMLFormElement>, productoId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const nombre = (formData.get('nombre') as string)?.trim();
    if (!nombre) return;
    const precioExtra = Number(formData.get('precioExtra'));
    // Optimista: el item aparece al instante; el form se limpia de inmediato.
    agregarVariante.mutate({ productoId, nombre, precioExtra: isNaN(precioExtra) ? 0 : precioExtra });
    form.reset();
  };

  const handleEditarPrecioVariante = (
    modificadorId: string,
    nombre: string,
    precioActual: string | number
  ) => {
    const nuevo = prompt(`Nuevo precio extra para ${nombre}. Actual: $${Number(precioActual)}.`);
    if (nuevo === null) return;
    if (isNaN(Number(nuevo)) || Number(nuevo) < 0) return;
    editarPrecio.mutate({ modificadorId, nuevoPrecio: Number(nuevo) });
  };

  const handleEliminarVariante = (productoId: string, modificadorId: string, nombre: string) => {
    if (!confirm(`¿Eliminar la variante "${nombre}"?`)) return;
    eliminarVariante.mutate({ productoId, modificadorId });
  };

  const toggleExpandido = (productoId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

  const canManage = userRole === 'owner' || userRole === 'admin';
  const canManagePrices = userRole === 'owner' || userRole === 'admin';

  const tabClass = (tab: typeof activeTab) =>
    `flex-1 py-4 font-medium text-center transition ${
      activeTab === tab
        ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        <button className={tabClass('categorias')} onClick={() => setActiveTab('categorias')}>
          Categorías
        </button>
        <button className={tabClass('productos')} onClick={() => setActiveTab('productos')}>
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
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Añadir
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
                            if(confirm(`¿Eliminar la categoría ${c.nombre}?`)) eliminarCategoriaMut.mutate(c.id);
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
                  <button type="submit" className="w-full bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
                    +
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
                  const estaExpandido = expandidos.has(p.id);
                  const variantesDelProducto = variantesPorProducto.get(p.id) ?? [];
                  return (
                    <div key={p.id} className="border rounded-md hover:border-blue-200 transition">
                      <div className="flex flex-col md:flex-row justify-between items-center p-4">
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg text-gray-800">{p.nombre}</h3>
                            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                              {categoria?.nombre || 'Sin categoría'}
                            </span>
                            {variantesDelProducto.length > 0 && (
                              <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                {variantesDelProducto.length} variante{variantesDelProducto.length === 1 ? '' : 's'}
                              </span>
                            )}
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
                                  modificarPrecioMut.mutate({ productoId: p.id, nuevoPrecio: Number(newPrice) });
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
                                if(confirm(`¿Eliminar producto ${p.nombre}?`)) eliminarProductoMut.mutate(p.id);
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

                      {/* Variantes del plato */}
                      {canManage && (
                        <div className="border-t bg-gray-50/60">
                          <button
                            onClick={() => toggleExpandido(p.id)}
                            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                          >
                            <span>
                              Variantes del plato
                              {variantesDelProducto.length > 0 && ` (${variantesDelProducto.length})`}
                            </span>
                            <span className="text-gray-400">{estaExpandido ? '▲' : '▼'}</span>
                          </button>

                          {estaExpandido && (
                            <div className="px-4 pb-4 space-y-3">
                              {variantesDelProducto.length === 0 ? (
                                <p className="text-sm text-gray-500">Este plato todavía no tiene variantes.</p>
                              ) : (
                                <ul className="divide-y border rounded-md bg-white">
                                  {variantesDelProducto.map((v) => (
                                    <li key={v.id} className="flex justify-between items-center px-3 py-2">
                                      <span className="font-medium text-gray-800">{v.nombre}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-600">
                                          {Number(v.precio) > 0
                                            ? `+$${Number(v.precio).toLocaleString('es-AR')}`
                                            : 'Sin costo'}
                                        </span>
                                        {canManagePrices && (
                                          <button
                                            onClick={() => handleEditarPrecioVariante(v.id, v.nombre, v.precio)}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                                          >
                                            Precio
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleEliminarVariante(p.id, v.id, v.nombre)}
                                          disabled={
                                            eliminarVariante.isPending &&
                                            eliminarVariante.variables?.modificadorId === v.id
                                          }
                                          className="text-red-400 hover:text-red-600 disabled:opacity-50"
                                          title="Eliminar variante"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* Agregar variante a este plato */}
                              <form
                                onSubmit={(e) => handleAgregarVariante(e, p.id)}
                                className="flex flex-col sm:flex-row gap-2"
                              >
                                <input
                                  name="nombre"
                                  placeholder="Nueva variante (ej: Doble carne)"
                                  required
                                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                                />
                                <input
                                  name="precioExtra"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  defaultValue="0"
                                  placeholder="Extra ($)"
                                  className="sm:w-32 px-3 py-2 border rounded-md text-sm"
                                />
                                <button
                                  type="submit"
                                  className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                  Agregar variante
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      )}
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
