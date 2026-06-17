'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import {
  cambiarEstadoReservaAction,
  sentarReservaAction,
  getReservasDelDiaAction,
} from '@/features/reservas/reservas-actions';
import type { ReservasConfig } from '@/features/reservas/reservas-config';

type Reserva = {
  id: string;
  nombreContacto: string;
  telefono: string;
  mesaId: string | null;
  inicio: string | Date;
  duracionMin: number;
  cantidadPersonas: number;
  estado: string;
  notas: string | null;
};

type Mesa = { id: string; identificador: string; capacidad: number };

const COLOR: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-700',
  Confirmada: 'bg-blue-100 text-blue-700',
  Sentada: 'bg-green-100 text-green-700',
  NoShow: 'bg-red-100 text-red-700',
  Cancelada: 'bg-gray-100 text-gray-500',
  Cumplida: 'bg-gray-100 text-gray-500',
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function horaDe(inicio: string | Date) {
  return new Date(inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ymdDeReserva(inicio: string | Date) {
  return toYMD(new Date(inicio));
}

export function ReservasManager({
  tenantId,
  fecha,
  mesKey,
  desdeISO,
  hastaISO,
  initialReservas,
  mesas,
  config,
}: {
  tenantId: string;
  fecha: string;
  mesKey: string;
  desdeISO: string;
  hastaISO: string;
  initialReservas: Reserva[];
  mesas: Mesa[];
  config: ReservasConfig;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.reservasMes(tenantId, mesKey);
  const [mesaElegida, setMesaElegida] = useState<Record<string, string>>({});
  const [diaSel, setDiaSel] = useState<string>(fecha);

  // Al navegar de mes (cambia `fecha` por URL) saltamos al día correspondiente.
  // Click de día dentro del mes no toca `fecha`, así que no interfiere.
  useEffect(() => {
    setDiaSel(fecha);
  }, [fecha]);

  const { data: reservas = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await getReservasDelDiaAction(desdeISO, hastaISO);
      return res.success ? (res.reservas as Reserva[]) : [];
    },
    initialData: initialReservas,
  });

  // Realtime: invalidar cuando entra una reserva nueva.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'reserva_nueva' }, () =>
        queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, queryKey]);

  // Conteo de reservas (no canceladas) por día para los badges del calendario.
  const porDia = useMemo(() => {
    const map = new Map<string, { reservas: number; cubiertos: number }>();
    for (const r of reservas) {
      if (r.estado === 'Cancelada') continue;
      const k = ymdDeReserva(r.inicio);
      const prev = map.get(k) ?? { reservas: 0, cubiertos: 0 };
      prev.reservas += 1;
      prev.cubiertos += r.cantidadPersonas;
      map.set(k, prev);
    }
    return map;
  }, [reservas]);

  const reservasDelDia = useMemo(
    () =>
      reservas
        .filter((r) => ymdDeReserva(r.inicio) === diaSel)
        .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()),
    [reservas, diaSel],
  );

  // Grilla del mes (lunes primero), con celdas de relleno fuera del mes.
  const celdas = useMemo(() => {
    const [y, m] = mesKey.split('-').map(Number);
    const primero = new Date(y, m - 1, 1);
    const offset = (primero.getDay() + 6) % 7; // Lun=0 … Dom=6
    const diasEnMes = new Date(y, m, 0).getDate();
    const out: { ymd: string; dia: number; inMonth: boolean }[] = [];
    for (let i = 0; i < offset; i++) out.push({ ymd: '', dia: 0, inMonth: false });
    for (let d = 1; d <= diasEnMes; d++) {
      out.push({ ymd: toYMD(new Date(y, m - 1, d)), dia: d, inMonth: true });
    }
    while (out.length % 7 !== 0) out.push({ ymd: '', dia: 0, inMonth: false });
    return out;
  }, [mesKey]);

  const irAMes = (delta: number) => {
    const [y, m] = mesKey.split('-').map(Number);
    const destino = new Date(y, m - 1 + delta, 1);
    router.push(`/admin/reservas?fecha=${toYMD(destino)}`);
  };

  const hoy = toYMD(new Date());
  const [y, m] = mesKey.split('-').map(Number);
  const tituloMes = `${MESES[m - 1]} ${y}`;

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      cambiarEstadoReservaAction(id, estado as never),
    onSuccess: (res) => {
      if (!res.success) alert(res.message);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const sentar = useMutation({
    mutationFn: ({ id, mesaId }: { id: string; mesaId: string }) => sentarReservaAction(id, mesaId),
    onSuccess: (res) => {
      if (!res.success) alert(res.message);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const busyId =
    (cambiarEstado.isPending && cambiarEstado.variables?.id) ||
    (sentar.isPending && sentar.variables?.id) ||
    null;

  const diaSelLegible = (() => {
    const [yy, mm, dd] = diaSel.split('-').map(Number);
    return `${dd} de ${MESES[mm - 1]}`;
  })();

  const cuposDia = porDia.get(diaSel) ?? { reservas: 0, cubiertos: 0 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-8 items-start">
      {/* Calendario */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => irAMes(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <h2 className="font-semibold text-gray-800 capitalize">{tituloMes}</h2>
          <button
            onClick={() => irAMes(1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, i) => {
            if (!c.inMonth) return <div key={`x${i}`} />;
            const info = porDia.get(c.ymd);
            const sel = c.ymd === diaSel;
            const esHoy = c.ymd === hoy;
            return (
              <button
                key={c.ymd}
                onClick={() => setDiaSel(c.ymd)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${
                  sel
                    ? 'bg-blue-600 text-white'
                    : esHoy
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className={esHoy && !sel ? 'font-bold' : ''}>{c.dia}</span>
                {info && info.reservas > 0 && (
                  <span
                    className={`mt-0.5 text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded-full ${
                      sel ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {config.maxReservasPorDia
                      ? `${info.reservas}/${config.maxReservasPorDia}`
                      : info.reservas}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <label className="text-xs text-gray-500">Ir a una fecha</label>
          <input
            type="date"
            value={diaSel}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v.slice(0, 7) === mesKey) setDiaSel(v);
              else router.push(`/admin/reservas?fecha=${v}`);
            }}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Agenda del día */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold text-gray-800 capitalize">{diaSelLegible}</h2>
          <p className="text-sm text-gray-500">
            {cuposDia.reservas} reserva{cuposDia.reservas === 1 ? '' : 's'} · {cuposDia.cubiertos}{' '}
            cubierto{cuposDia.cubiertos === 1 ? '' : 's'}
            {config.maxReservasPorDia ? ` · cupo ${cuposDia.reservas}/${config.maxReservasPorDia}` : ''}
          </p>
        </div>

        {reservasDelDia.length === 0 ? (
          <p className="text-gray-500 text-center py-10 bg-white rounded-xl border border-gray-100">
            No hay reservas para este día.
          </p>
        ) : (
          <div className="space-y-3">
            {reservasDelDia.map((r) => {
              const busy = busyId === r.id;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4 justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-gray-800">{horaDe(r.inicio)}</div>
                      <div className="text-xs text-gray-400">{r.cantidadPersonas} pers.</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{r.nombreContacto}</h3>
                      <p className="text-sm text-gray-500">{r.telefono}</p>
                      {r.notas && <p className="text-xs text-gray-400 mt-0.5">{r.notas}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${COLOR[r.estado] ?? ''}`}>
                      {r.estado}
                    </span>

                    {r.estado === 'Pendiente' && (
                      <button
                        onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'Confirmada' })}
                        disabled={busy}
                        className="text-sm bg-blue-600 disabled:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Confirmar
                      </button>
                    )}

                    {r.estado === 'Confirmada' && (
                      <>
                        <select
                          value={mesaElegida[r.id] ?? ''}
                          onChange={(e) =>
                            setMesaElegida((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                        >
                          <option value="">Asignar mesa…</option>
                          {mesas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.identificador} ({m.capacidad})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const mesaId = mesaElegida[r.id];
                            if (!mesaId) return;
                            sentar.mutate({ id: r.id, mesaId });
                          }}
                          disabled={busy || !mesaElegida[r.id]}
                          className="text-sm bg-green-600 disabled:bg-green-300 text-white px-3 py-1.5 rounded-lg font-medium"
                        >
                          Sentar
                        </button>
                      </>
                    )}

                    {(r.estado === 'Pendiente' || r.estado === 'Confirmada') && (
                      <>
                        <button
                          onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'NoShow' })}
                          disabled={busy}
                          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium"
                        >
                          No-show
                        </button>
                        <button
                          onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'Cancelada' })}
                          disabled={busy}
                          className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium"
                        >
                          Cancelar
                        </button>
                      </>
                    )}

                    {r.estado === 'Sentada' && (
                      <button
                        onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'Cumplida' })}
                        disabled={busy}
                        className="text-sm bg-gray-700 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Marcar cumplida
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
