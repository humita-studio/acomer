'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { actualizarDeliveryConfigAction } from '@/features/comanda/delivery-config-actions';
import type { DeliveryConfig, AgregadosHasta } from '@/features/comanda/delivery-config';

const MODO_OPCIONES: { value: DeliveryConfig['modo']; label: string; desc: string }[] = [
  { value: 'ambos', label: 'Retiro y envío', desc: 'Ofrecés las dos modalidades.' },
  { value: 'takeaway', label: 'Solo retiro', desc: 'El cliente solo puede retirar en el local.' },
  { value: 'delivery', label: 'Solo envío', desc: 'El cliente solo puede pedir a domicilio.' },
];

const AGREGADOS_OPCIONES: { value: AgregadosHasta; label: string; desc: string }[] = [
  { value: 'no', label: 'No permitir', desc: 'Una vez confirmado, el pedido queda cerrado.' },
  {
    value: 'preparacion',
    label: 'Hasta que lo empecemos a preparar',
    desc: 'Puede agregar mientras el pedido sigue en "Recibido".',
  },
  {
    value: 'listo',
    label: 'Hasta que esté listo',
    desc: 'Puede agregar mientras se prepara, hasta marcarlo "Listo".',
  },
];

export function DeliveryConfigForm({ initialConfig }: { initialConfig: DeliveryConfig }) {
  const router = useRouter();
  const [activo, setActivo] = useState(initialConfig.activo);
  const [modo, setModo] = useState<DeliveryConfig['modo']>(initialConfig.modo);
  const [agregadosHasta, setAgregadosHasta] = useState<AgregadosHasta>(initialConfig.agregadosHasta);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => actualizarDeliveryConfigAction({ activo, modo, agregadosHasta }),
    onSuccess: (res) => {
      if (res.success) {
        setOkMsg(res.message ?? 'Guardado');
        setError(null);
        router.refresh();
        setTimeout(() => setOkMsg(null), 2500);
      } else {
        setError(res.message ?? 'No se pudo guardar');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Pedidos online activos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Pedidos online</h2>
          <p className="text-sm text-gray-500">Si está apagado, la carta pública no toma pedidos.</p>
        </div>
        <button
          type="button"
          onClick={() => setActivo((v) => !v)}
          className={`relative w-12 h-7 rounded-full transition-colors ${activo ? 'bg-green-500' : 'bg-gray-300'}`}
          aria-pressed={activo}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>

      {/* Modalidades */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Modalidades que ofrecés</h2>
          <p className="text-sm text-gray-500">Qué puede elegir el cliente al finalizar su pedido.</p>
        </div>
        <div className="space-y-2">
          {MODO_OPCIONES.map((op) => (
            <label
              key={op.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                modo === op.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <input
                type="radio"
                name="modo"
                value={op.value}
                checked={modo === op.value}
                onChange={() => setModo(op.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-gray-800">{op.label}</span>
                <span className="block text-sm text-gray-500">{op.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Agregados después de confirmar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Agregar productos a un pedido ya hecho</h2>
          <p className="text-sm text-gray-500">
            Hasta cuándo el cliente puede sumar productos después de confirmar (y pagar).
          </p>
        </div>
        <div className="space-y-2">
          {AGREGADOS_OPCIONES.map((op) => (
            <label
              key={op.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                agregadosHasta === op.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <input
                type="radio"
                name="agregadosHasta"
                value={op.value}
                checked={agregadosHasta === op.value}
                onChange={() => setAgregadosHasta(op.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-gray-800">{op.label}</span>
                <span className="block text-sm text-gray-500">{op.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}
      {okMsg && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium">{okMsg}</div>}

      <button
        type="submit"
        disabled={guardar.isPending}
        className="bg-blue-600 disabled:bg-blue-400 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-blue-200"
      >
        {guardar.isPending ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
}
