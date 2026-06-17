'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { abrirMesaAction } from '@/features/mesas/mesas-actions';

/**
 * Botón para que el mozo abra (ocupe) la mesa sin que el cliente escanee el QR,
 * por ejemplo cuando alguien se niega a pedir desde su teléfono.
 */
export function AbrirMesaButton({ mesaId }: { mesaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAbrir = async () => {
    setLoading(true);
    setError(null);
    const res = await abrirMesaAction(mesaId);
    setLoading(false);
    if (res.success) {
      router.refresh();
    } else {
      setError(res.message || 'No se pudo abrir la mesa');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <p className="text-gray-500 mb-5">
        Esta mesa no tiene una sesión activa. Podés abrirla vos para tomar el pedido, o se abre
        sola cuando un comensal escanea el QR.
      </p>
      <button
        onClick={handleAbrir}
        disabled={loading}
        className="bg-green-600 text-white font-bold px-6 py-3 rounded-md hover:bg-green-700 transition disabled:opacity-50"
      >
        {loading ? 'Abriendo...' : 'Abrir mesa y tomar pedido'}
      </button>
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mt-4 text-sm font-medium">{error}</div>
      )}
    </div>
  );
}
