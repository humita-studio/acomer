'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCartTotal, type CartItem } from '../store';
import { crearPedidoExternoAction } from '../pedido-externo-actions';
import { useLocalCartStore } from '../cart/local-cart';

type Tipo = 'takeaway' | 'delivery';

export function CheckoutExterno({
  open,
  onClose,
  tenantSlug,
  cartItems,
}: {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  cartItems: CartItem[];
}) {
  const router = useRouter();
  const limpiar = useLocalCartStore((s) => s.limpiar);
  const [tipo, setTipo] = useState<Tipo>('takeaway');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const total = getCartTotal(cartItems);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (cartItems.length === 0) {
      setError('Tu carrito está vacío');
      return;
    }
    setEnviando(true);
    try {
      const res = await crearPedidoExternoAction(
        tenantSlug,
        tipo,
        {
          nombreContacto: nombre,
          telefono,
          direccion: tipo === 'delivery' ? direccion : undefined,
          referencia: tipo === 'delivery' ? referencia : undefined,
        },
        cartItems.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          modificadores: i.modificadores.map((m) => ({ id: m.id })),
        })),
      );
      if (res.success && res.sesionId) {
        limpiar();
        // El tenant viene del subdominio (proxy reescribe a /[tenant]/...), por
        // eso la URL no lleva el slug — igual que /mesa/<id>.
        router.push(`/pedir?sesion=${res.sesionId}`);
      } else {
        setError(res.message ?? 'No se pudo confirmar el pedido');
        setEnviando(false);
      }
    } catch {
      setError('No se pudo confirmar el pedido');
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5 animate-in slide-in-from-bottom-10"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Finalizá tu pedido</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Selector de tipo */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipo('takeaway')}
            className={`py-3 rounded-xl font-semibold border transition-colors ${
              tipo === 'takeaway'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
            }`}
          >
            Retiro en local
          </button>
          <button
            type="button"
            onClick={() => setTipo('delivery')}
            className={`py-3 rounded-xl font-semibold border transition-colors ${
              tipo === 'delivery'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
            }`}
          >
            Envío a domicilio
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: 11 2345 6789"
            />
          </div>

          {tipo === 'delivery' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Calle, número, piso/depto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: timbre roto, golpear"
                />
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-blue-600 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-md shadow-blue-200 flex justify-between px-6 items-center"
        >
          <span>{enviando ? 'Confirmando…' : 'Confirmar pedido'}</span>
          <span>${total.toFixed(2)}</span>
        </button>
      </form>
    </div>
  );
}
