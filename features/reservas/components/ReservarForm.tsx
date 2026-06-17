'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { getDisponibilidadAction, crearReservaAction } from '../reservas-actions';

const TURNOS_FALLBACK = ['12:00', '12:30', '13:00', '13:30', '14:00', '20:00', '20:30', '21:00', '21:30', '22:00'];

const MENSAJE_SIN_LUGAR: Record<string, string> = {
  inactivo: 'Por el momento no estamos tomando reservas online.',
  cupo_dia: 'Ya no quedan reservas disponibles para ese día. Probá otra fecha.',
  cupo_turno: 'Ese turno está completo. Probá otro horario.',
  sin_mesa: 'No hay mesas disponibles para ese horario. Probá otro día u horario.',
};

export function ReservarForm({ tenantSlug, turnos }: { tenantSlug: string; turnos?: string[] }) {
  const TURNOS = turnos && turnos.length > 0 ? turnos : TURNOS_FALLBACK;
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState(TURNOS[0]);
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inicioISO = fecha ? new Date(`${fecha}T${hora}:00`).toISOString() : '';

  // Disponibilidad: on-demand (enabled:false). La key cambia con horario/personas,
  // así que al tocar cualquier parámetro el resultado previo se "resetea" solo.
  const disponibilidad = useQuery({
    queryKey: queryKeys.disponibilidad(inicioISO, personas),
    queryFn: () => getDisponibilidadAction(tenantSlug, inicioISO, personas),
    enabled: false,
  });

  const consultado = disponibilidad.data !== undefined && disponibilidad.isFetched;
  const hayLugar = !!disponibilidad.data?.success && (disponibilidad.data.mesas?.length ?? 0) > 0;
  const motivo = (disponibilidad.data as { motivo?: string } | undefined)?.motivo;

  const crear = useMutation({
    mutationFn: () =>
      crearReservaAction(tenantSlug, { nombreContacto: nombre, telefono, inicioISO, personas, notas }),
    onSuccess: (res) => {
      if (!res.success) setError(res.message ?? 'No se pudo crear la reserva');
    },
  });

  const handleConsultar = () => {
    setError(null);
    if (!fecha) {
      setError('Elegí una fecha');
      return;
    }
    disponibilidad.refetch();
  };

  const handleConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    crear.mutate();
  };

  if (crear.isSuccess && crear.data?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md">
          <h1 className="text-2xl font-bold text-green-600 mb-2">¡Reserva enviada! 🎉</h1>
          <p className="text-gray-600">Te confirmaremos la reserva a la brevedad. ¡Gracias {nombre}!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleConfirmar} className="bg-white w-full max-w-md p-6 rounded-2xl shadow-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Reservá tu mesa</h1>
          <p className="text-sm text-gray-500 mt-1">Elegí día, horario y cantidad de personas</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horario</label>
            <select
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TURNOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personas</label>
            <input
              type="number"
              min={1}
              max={30}
              value={personas}
              onChange={(e) => setPersonas(Math.max(1, Number(e.target.value)))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {!consultado && (
          <button
            type="button"
            onClick={handleConsultar}
            disabled={disponibilidad.isFetching}
            className="w-full bg-blue-600 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-md shadow-blue-200 transition-colors"
          >
            {disponibilidad.isFetching ? 'Consultando…' : 'Ver disponibilidad'}
          </button>
        )}

        {consultado && !hayLugar && (
          <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm font-medium text-center">
            {(motivo && MENSAJE_SIN_LUGAR[motivo]) ?? MENSAJE_SIN_LUGAR.sin_mesa}
          </div>
        )}

        {consultado && hayLugar && (
          <>
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium text-center">
              ¡Hay disponibilidad! Completá tus datos para reservar.
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: festejo de cumpleaños"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={crear.isPending}
              className="w-full bg-green-600 disabled:bg-green-400 text-white font-bold py-4 rounded-xl shadow-md shadow-green-200 transition-colors"
            >
              {crear.isPending ? 'Reservando…' : 'Confirmar reserva'}
            </button>
          </>
        )}

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}
      </form>
    </div>
  );
}
