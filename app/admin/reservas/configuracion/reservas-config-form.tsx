'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { actualizarReservasConfigAction } from '@/features/reservas/reservas-config-actions';
import type { ReservasConfig } from '@/features/reservas/reservas-config';

function esHoraValida(h: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(h.trim());
}

function normalizar(h: string): string {
  const [hh, mm] = h.trim().split(':');
  return `${hh.padStart(2, '0')}:${mm}`;
}

export function ReservasConfigForm({ initialConfig }: { initialConfig: ReservasConfig }) {
  const router = useRouter();
  const [activo, setActivo] = useState(initialConfig.activo);
  const [turnos, setTurnos] = useState<string[]>(initialConfig.turnos);
  const [nuevoTurno, setNuevoTurno] = useState('');
  const [duracion, setDuracion] = useState(initialConfig.duracionMinDefault);
  const [cupoTurno, setCupoTurno] = useState<string>(
    initialConfig.cupoCubiertosPorTurno != null ? String(initialConfig.cupoCubiertosPorTurno) : '',
  );
  const [maxDia, setMaxDia] = useState<string>(
    initialConfig.maxReservasPorDia != null ? String(initialConfig.maxReservasPorDia) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const agregarTurno = () => {
    setError(null);
    if (!esHoraValida(nuevoTurno)) {
      setError('Horario inválido. Usá el formato HH:MM (ej: 21:30).');
      return;
    }
    const h = normalizar(nuevoTurno);
    if (turnos.includes(h)) {
      setNuevoTurno('');
      return;
    }
    setTurnos([...turnos, h].sort());
    setNuevoTurno('');
  };

  const quitarTurno = (h: string) => setTurnos(turnos.filter((t) => t !== h));

  const guardar = useMutation({
    mutationFn: () =>
      actualizarReservasConfigAction({
        activo,
        turnos,
        duracionMinDefault: duracion,
        cupoCubiertosPorTurno: cupoTurno.trim() === '' ? null : Number(cupoTurno),
        maxReservasPorDia: maxDia.trim() === '' ? null : Number(maxDia),
      }),
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
    if (turnos.length === 0) {
      setError('Agregá al menos un turno.');
      return;
    }
    guardar.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Reservas activas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Reservas online</h2>
          <p className="text-sm text-gray-500">Si está apagado, el formulario público no toma reservas.</p>
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

      {/* Turnos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Turnos disponibles</h2>
          <p className="text-sm text-gray-500">Horarios que el cliente puede elegir al reservar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {turnos.length === 0 && <span className="text-sm text-gray-400">Sin turnos cargados.</span>}
          {turnos.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium"
            >
              {t}
              <button
                type="button"
                onClick={() => quitarTurno(t)}
                className="text-blue-400 hover:text-blue-700"
                aria-label={`Quitar ${t}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="time"
            value={nuevoTurno}
            onChange={(e) => setNuevoTurno(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            onClick={agregarTurno}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            Agregar turno
          </button>
        </div>
      </div>

      {/* Duración + cupos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
          <input
            type="number"
            min={15}
            step={15}
            value={duracion}
            onChange={(e) => setDuracion(Math.max(15, Number(e.target.value)))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cubiertos por turno</label>
          <input
            type="number"
            min={1}
            placeholder="Sin límite"
            value={cupoTurno}
            onChange={(e) => setCupoTurno(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reservas por día</label>
          <input
            type="number"
            min={1}
            placeholder="Sin límite"
            value={maxDia}
            onChange={(e) => setMaxDia(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
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
