'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { liberarMesaAction } from '@/features/mesas/mesas-actions';
import { useTicketMesa, useAgregarItemsStaff } from '@/features/comanda/use-ticket-mesa';
import { queryKeys } from '@/shared/query/keys';
import { useConfirm } from '@/shared/ui/confirm-dialog';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import type { ProductoMenu, CategoriaMenu, ModificadorMenu } from '@/features/carta/types';
import type { TicketItem } from '@/features/pedidos/obtenerTicketMesa';

type Props = {
  mesaId: string;
  sesionMesaId: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
  ticketInicial: { items: TicketItem[]; total: number };
};

export function MesaPedidoManager({ mesaId, sesionMesaId, categorias, productos, ticketInicial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [activeCategory, setActiveCategory] = useState<string>(categorias[0]?.id || '');
  const [selectedProduct, setSelectedProduct] = useState<ProductoMenu | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [selectedModIds, setSelectedModIds] = useState<string[]>([]);
  const [selectedVarianteId, setSelectedVarianteId] = useState<string | null>(null);
  const [isLiberating, setIsLiberating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ítem libre: algo que no está en la carta (nombre + precio a mano).
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeNombre, setFreeNombre] = useState('');
  const [freePrecio, setFreePrecio] = useState('');
  const [freeCantidad, setFreeCantidad] = useState(1);
  const [freeError, setFreeError] = useState<string | null>(null);

  // Estado de servidor del ticket (TanStack Query) con update optimista al agregar
  const { data: ticket = { items: [], total: 0 } } = useTicketMesa(sesionMesaId, ticketInicial);
  const agregar = useAgregarItemsStaff(sesionMesaId);

  // Realtime: si el comensal (u otro dispositivo) agrega items, refrescar el ticket
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`mesa_${sesionMesaId}`);
    channel
      .on('broadcast', { event: 'ticket_actualizado' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketMesa(sesionMesaId) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sesionMesaId, queryClient]);

  const activeProducts = productos.filter((p) => p.categoriaId === activeCategory);

  const openProduct = (prod: ProductoMenu) => {
    setSelectedProduct(prod);
    setCantidad(1);
    setSelectedModIds([]);
    setSelectedVarianteId(
      prod.variantes.length > 0
        ? (prod.variantes.find((v) => v.esDefault) ?? prod.variantes[0]).id
        : null,
    );
    setError(null);
  };

  const toggleMod = (mod: ModificadorMenu) => {
    setSelectedModIds((prev) =>
      prev.includes(mod.id) ? prev.filter((id) => id !== mod.id) : [...prev, mod.id],
    );
  };

  const varianteSel = selectedProduct?.variantes.find((v) => v.id === selectedVarianteId) ?? null;
  const precioBaseModal = varianteSel ? varianteSel.precio : selectedProduct?.precio ?? 0;
  const modsTotal = selectedProduct
    ? selectedProduct.modificadores
        .filter((m) => selectedModIds.includes(m.id))
        .reduce((sum, m) => sum + m.precioExtra, 0)
    : 0;
  const subtotalModal = selectedProduct ? (precioBaseModal + modsTotal) * cantidad : 0;

  const handleAgregar = () => {
    if (!selectedProduct) return;
    const modsSeleccionados = selectedProduct.modificadores.filter((m) =>
      selectedModIds.includes(m.id),
    );
    const precioBase = varianteSel ? varianteSel.precio : selectedProduct.precio;
    const precioConMods = precioBase + modsSeleccionados.reduce((s, m) => s + m.precioExtra, 0);
    const nombreItem = varianteSel
      ? `${selectedProduct.nombre} ${varianteSel.nombre}`
      : selectedProduct.nombre;
    const optimisticItem: TicketItem = {
      id: `temp-${crypto.randomUUID()}`,
      nombre: nombreItem,
      cantidad,
      precioUnitario: precioBase,
      modificadores: modsSeleccionados.map((m) => ({ nombre: m.nombre, precioExtra: m.precioExtra })),
      subtotal: precioConMods * cantidad,
    };
    // Optimista: el item aparece en la cuenta al instante y cerramos el modal.
    agregar.mutate({
      items: [
        {
          productoId: selectedProduct.id,
          varianteId: varianteSel?.id ?? null,
          cantidad,
          modificadorIds: selectedModIds,
        },
      ],
      optimisticItems: [optimisticItem],
    });
    setSelectedProduct(null);
  };

  const openFree = () => {
    setFreeNombre('');
    setFreePrecio('');
    setFreeCantidad(1);
    setFreeError(null);
    setFreeOpen(true);
  };

  const handleAgregarLibre = () => {
    const nombre = freeNombre.trim();
    const precio = parseFloat(freePrecio.replace(',', '.'));
    if (!nombre) {
      setFreeError('Poné un nombre');
      return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      setFreeError('El precio tiene que ser mayor a 0');
      return;
    }
    const optimisticItem: TicketItem = {
      id: `temp-${crypto.randomUUID()}`,
      nombre,
      cantidad: freeCantidad,
      precioUnitario: precio,
      modificadores: [],
      subtotal: precio * freeCantidad,
    };
    agregar.mutate({
      items: [{ productoId: null, cantidad: freeCantidad, nombreLibre: nombre, precioLibre: precio }],
      optimisticItems: [optimisticItem],
    });
    setFreeOpen(false);
  };

  const freeSubtotal = (parseFloat(freePrecio.replace(',', '.')) || 0) * freeCantidad;

  const handleLiberar = async () => {
    if (!(await confirm({
      titulo: '¿Liberar la mesa?',
      descripcion: 'Se cerrará la sesión actual.',
      confirmLabel: 'Liberar',
      destructivo: true,
    }))) return;
    setIsLiberating(true);
    setError(null);
    const res = await liberarMesaAction(mesaId);
    setIsLiberating(false);
    if (res.success) {
      router.push('/admin/mesas');
      router.refresh();
    } else {
      setError(res.message || 'No se pudo liberar la mesa');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {confirmDialog}
      {/* Ticket de la mesa */}
      <aside className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow p-5 lg:sticky lg:top-6">
          <h2 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Cuenta de la mesa</h2>

          {ticket.items.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Todavía no hay pedidos en esta mesa.</p>
          ) : (
            <div className="space-y-3">
              {ticket.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-medium text-gray-800">
                      {item.cantidad}× {item.nombre}
                    </p>
                    {item.modificadores.length > 0 && (
                      <p className="text-xs text-gray-500">
                        + {item.modificadores.map((m) => m.nombre).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-gray-700">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center mt-4 pt-3 border-t font-bold text-gray-800">
            <span>Total</span>
            <span>${ticket.total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleLiberar}
            disabled={isLiberating}
            className="w-full mt-5 text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 py-2 rounded-md transition text-sm font-bold disabled:opacity-50"
          >
            {isLiberating ? 'Liberando...' : 'Liberar Mesa'}
          </button>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mt-4 text-sm font-medium">{error}</div>
          )}
        </div>
      </aside>

      {/* Selector de productos */}
      <section className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="font-bold text-lg text-gray-800">Agregar al pedido</h2>
            <button
              onClick={openFree}
              className="shrink-0 text-sm font-semibold text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              + Ítem libre
            </button>
          </div>

          {categorias.length === 0 ? (
            <p className="text-sm text-gray-500">No hay productos cargados en el menú.</p>
          ) : (
            <>
              <div className="overflow-x-auto whitespace-nowrap pb-3 mb-2">
                <div className="flex gap-2">
                  {categorias.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${
                        activeCategory === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.nombre}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6">No hay productos en esta categoría.</p>
                ) : (
                  activeProducts.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => openProduct(prod)}
                      className="text-left bg-white p-4 rounded-xl border border-gray-100 hover:border-blue-300 transition-all flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-800">{prod.nombre}</h3>
                        <p className="font-bold text-blue-600 mt-1">
                          {prod.variantes.length > 0 && <span className="font-normal text-gray-500">desde </span>}
                          ${prod.precio.toFixed(2)}
                        </p>
                      </div>
                      <span className="bg-blue-50 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center shrink-0 ml-3 text-xl">
                        +
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Modal de carga de producto */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-xl">{selectedProduct.nombre}</h2>
              <button onClick={() => setSelectedProduct(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {selectedProduct.variantes.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-semibold border-b pb-2">Elegí una opción</h3>
                  {selectedProduct.variantes.map((v) => (
                    <label
                      key={v.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variante-staff"
                          className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                          checked={selectedVarianteId === v.id}
                          onChange={() => setSelectedVarianteId(v.id)}
                        />
                        <span className="font-medium">{v.nombre}</span>
                      </div>
                      <span className="text-gray-600">${v.precio.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="font-medium text-gray-700">Precio base: ${selectedProduct.precio.toFixed(2)}</div>
              )}

              {selectedProduct.modificadores.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold border-b pb-2">Adicionales</h3>
                  {selectedProduct.modificadores.map((mod) => (
                    <label
                      key={mod.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                          checked={selectedModIds.includes(mod.id)}
                          onChange={() => toggleMod(mod)}
                        />
                        <span className="font-medium">{mod.nombre}</span>
                      </div>
                      {mod.precioExtra > 0 && <span className="text-gray-600">+${mod.precioExtra.toFixed(2)}</span>}
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-center gap-6 py-2">
                <button
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full text-2xl hover:bg-gray-200"
                >
                  -
                </button>
                <span className="text-2xl font-bold w-8 text-center">{cantidad}</span>
                <button
                  onClick={() => setCantidad(cantidad + 1)}
                  className="w-12 h-12 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-2xl hover:bg-blue-200"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={handleAgregar}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors flex justify-between px-6 items-center disabled:bg-blue-400"
              >
                <span>Agregar al pedido</span>
                <span>${subtotalModal.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de ítem libre */}
      {freeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col shadow-xl">
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h2 className="font-bold text-xl">Ítem libre</h2>
                <p className="text-sm text-gray-500">Algo que no está en la carta</p>
              </div>
              <button onClick={() => setFreeOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
                <input
                  value={freeNombre}
                  onChange={(e) => setFreeNombre(e.target.value)}
                  autoFocus
                  placeholder="Ej. Torta de la abuela"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Precio</label>
                  <input
                    value={freePrecio}
                    onChange={(e) => setFreePrecio(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cantidad</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFreeCantidad(Math.max(1, freeCantidad - 1))}
                      className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-xl hover:bg-gray-200"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold">{freeCantidad}</span>
                    <button
                      type="button"
                      onClick={() => setFreeCantidad(freeCantidad + 1)}
                      className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg text-xl hover:bg-blue-200"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">Se suma solo a esta venta. No se guarda en la carta.</p>
              {freeError && <p className="text-sm text-red-600 font-medium">{freeError}</p>}
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={handleAgregarLibre}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex justify-between px-6 items-center"
              >
                <span>Agregar al pedido</span>
                <span>${freeSubtotal.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
