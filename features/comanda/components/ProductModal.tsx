'use client';

import { useState } from 'react';
import { type Modificador } from '../store';
import { useAgregarItem } from '../use-borrador';
import { ProductoMenu } from './MenuDigital';

type ProductModalProps = {
  product: ProductoMenu;
  sesionMesaId: string;
  tenantId: string;
  onClose: () => void;
};

export function ProductModal({ product, sesionMesaId, tenantId, onClose }: ProductModalProps) {
  const agregar = useAgregarItem(tenantId, sesionMesaId);
  const [cantidad, setCantidad] = useState(1);
  const [selectedMods, setSelectedMods] = useState<Modificador[]>([]);

  const toggleModificador = (mod: Modificador) => {
    const exists = selectedMods.find((m) => m.id === mod.id);
    if (exists) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, mod]);
    }
  };

  const modsTotal = selectedMods.reduce((sum, mod) => sum + mod.precioExtra, 0);
  const subtotal = (product.precio + modsTotal) * cantidad;

  const handleAddToCart = async () => {
    // onMutate aplica el update optimista al instante; esperamos a que resuelva
    // (la mutación notifica a otros dispositivos y reconcilia) antes de cerrar.
    try {
      await agregar.mutateAsync({
        productoId: product.id,
        nombreProducto: product.nombre,
        precioUnitario: product.precio,
        cantidad,
        modificadores: selectedMods,
      });
    } catch {
      // Si falla, onError ya revirtió el optimismo; cerramos igual.
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl animate-in slide-in-from-bottom-10">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-bold text-xl">{product.nombre}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {product.descripcion && (
            <p className="text-gray-600">{product.descripcion}</p>
          )}

          <div className="font-medium text-lg">
            Precio Base: ${product.precio.toFixed(2)}
          </div>

          {/* Modificadores */}
          {product.permiteAdicionales && product.modificadores.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg border-b pb-2">Adicionales</h3>
              {product.modificadores.map((mod) => {
                const isSelected = selectedMods.some((m) => m.id === mod.id);
                return (
                  <label key={mod.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                        checked={isSelected}
                        onChange={() => toggleModificador(mod)}
                      />
                      <span className="font-medium">{mod.nombre}</span>
                    </div>
                    {mod.precioExtra > 0 && (
                      <span className="text-gray-600">+${mod.precioExtra.toFixed(2)}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {/* Selector de Cantidad */}
          <div className="flex items-center justify-center gap-6 py-4">
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

        {/* Footer / Add to Cart */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleAddToCart}
            disabled={agregar.isPending}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors flex justify-between px-6 items-center shadow-md shadow-blue-200 disabled:bg-blue-400"
          >
            <span>{agregar.isPending ? 'Agregando...' : 'Agregar al Pedido'}</span>
            <span>${subtotal.toFixed(2)}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
