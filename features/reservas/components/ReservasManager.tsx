'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, Settings } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  useReservasMes,
  useReservasRealtime,
  useProximaReserva,
  useReservaAnterior,
  useCambiarEstadoReserva,
  useSentarReserva,
  useCrearReservaAdmin,
} from '../hooks/useReservas';
import type { Reserva } from '../types';
import { turnoDeHora, horaAMin, type ReservasConfig } from '../reservasConfig';
import { toYMD, ymdDeReserva, diaLegible, diaLegibleLargo, hhmm } from '../fechas';
import { ReservasCalendar } from './ReservasCalendar';
import { ReservaCard, type AccionConfirmable } from './ReservaCard';
import { NuevaReservaDialog, type NuevaReservaDatos } from './NuevaReservaDialog';
import { CancelarReservaDialog } from './CancelarReservaDialog';
import { ReservasConfigDrawer } from './ReservasConfigDrawer';

type Conteo = { reservas: number; cubiertos: number };
type Grupo = { key: string; titulo: string; rango: string | null; reservas: Reserva[]; cubiertos: number };

// Estados que "ocupan" un lugar (mismo criterio que el cupo del server).
const ESTADOS_OCUPAN = new Set(['Pendiente', 'Confirmada', 'Sentada']);

function plural(n: number, sing: string, plur: string) {
  return `${n} ${n === 1 ? sing : plur}`;
}

export function ReservasManager({
  tenantId,
  fecha,
  mesKey,
  desdeISO,
  hastaISO,
  initialReservas,
  config,
}: {
  tenantId: string;
  fecha: string;
  mesKey: string;
  desdeISO: string;
  hastaISO: string;
  initialReservas: Reserva[];
  config: ReservasConfig;
}) {
  const router = useRouter();
  const [diaSel, setDiaSel] = useState(fecha);
  const [mesaElegida, setMesaElegida] = useState<Record<string, { id: string; label: string }>>({});
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ reserva: Reserva; accion: AccionConfirmable } | null>(null);

  // Al navegar de mes (cambia `fecha` por URL) saltamos al día correspondiente.
  const [fechaPrev, setFechaPrev] = useState(fecha);
  if (fecha !== fechaPrev) {
    setFechaPrev(fecha);
    setDiaSel(fecha);
  }

  const { data: reservas = [] } = useReservasMes({
    tenantId,
    mesKey,
    desdeISO,
    hastaISO,
    initial: initialReservas,
  });
  useReservasRealtime(tenantId, mesKey);

  const cambiarEstado = useCambiarEstadoReserva(tenantId, mesKey);
  const sentar = useSentarReserva(tenantId, mesKey);
  const crear = useCrearReservaAdmin(tenantId, mesKey);

  // Conteo de reservas (no canceladas) por día para los badges del calendario.
  const porDia = useMemo(() => {
    const map = new Map<string, Conteo>();
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

  // Agenda del día dividida por turno (Almuerzo/Cena…), en orden horario. Las
  // reservas fuera de todo turno caen en "Otros horarios" al final.
  const gruposDia = useMemo(() => {
    const grupos = new Map<string, Grupo>();
    const orden = [...config.turnos].sort((a, b) => (horaAMin(a.desde) ?? 0) - (horaAMin(b.desde) ?? 0));
    for (const t of orden) {
      grupos.set(t.nombre, { key: t.nombre, titulo: t.nombre, rango: `${t.desde}–${t.hasta}`, reservas: [], cubiertos: 0 });
    }
    const otros: Grupo = { key: '__otros__', titulo: 'Otros horarios', rango: null, reservas: [], cubiertos: 0 };

    for (const r of reservasDelDia) {
      const turno = turnoDeHora(config.turnos, hhmm(r.inicio));
      const g = (turno && grupos.get(turno.nombre)) || otros;
      g.reservas.push(r);
      if (ESTADOS_OCUPAN.has(r.estado)) g.cubiertos += r.cantidadPersonas;
    }

    const out = [...grupos.values()].filter((g) => g.reservas.length > 0);
    if (otros.reservas.length > 0) out.push(otros);
    return out;
  }, [reservasDelDia, config.turnos]);

  // Cuando el día elegido está vacío, ubicamos las reservas más cercanas (hacia
  // adelante y hacia atrás) para poder saltar a ellas. Primero buscamos dentro
  // del mes ya cargado (instantáneo): el día con reservas más próximo en cada
  // sentido respecto del día elegido.
  const diaVacio = reservasDelDia.length === 0;
  const { proximoDiaEnMes, diaAnteriorEnMes } = useMemo(() => {
    if (!diaVacio) return { proximoDiaEnMes: null, diaAnteriorEnMes: null };
    let proximo: string | null = null;
    let anterior: string | null = null;
    for (const [ymd, info] of porDia) {
      if (info.reservas === 0) continue;
      if (ymd > diaSel && (proximo === null || ymd < proximo)) proximo = ymd;
      if (ymd < diaSel && (anterior === null || ymd > anterior)) anterior = ymd;
    }
    return { proximoDiaEnMes: proximo, diaAnteriorEnMes: anterior };
  }, [porDia, diaSel, diaVacio]);

  // Si no hay ninguna en el mes para un sentido, consultamos al server la reserva
  // vigente más cercana en ese sentido fuera del mes (puede caer meses adelante
  // o atrás): hacia adelante desde el mes siguiente, hacia atrás desde este mes.
  const { data: proximaInicio, isFetching: buscandoProxima } = useProximaReserva({
    tenantId,
    desdeISO: hastaISO,
    enabled: diaVacio && proximoDiaEnMes === null,
  });
  const { data: anteriorInicio, isFetching: buscandoAnterior } = useReservaAnterior({
    tenantId,
    hastaISO: desdeISO,
    enabled: diaVacio && diaAnteriorEnMes === null,
  });
  const proximoDiaOtroMes = proximaInicio ? ymdDeReserva(proximaInicio) : null;
  const diaAnteriorOtroMes = anteriorInicio ? ymdDeReserva(anteriorInicio) : null;

  // Destinos finales por sentido: preferimos el del mes (sin navegar) y, si no,
  // el de otro mes (que navega por URL). `otroMes` decide cómo saltar.
  const saltoProximo = proximoDiaEnMes
    ? { ymd: proximoDiaEnMes, otroMes: false }
    : proximoDiaOtroMes
      ? { ymd: proximoDiaOtroMes, otroMes: true }
      : null;
  const saltoAnterior = diaAnteriorEnMes
    ? { ymd: diaAnteriorEnMes, otroMes: false }
    : diaAnteriorOtroMes
      ? { ymd: diaAnteriorOtroMes, otroMes: true }
      : null;

  const hoy = toYMD(new Date());
  const cuposHoy = porDia.get(hoy) ?? { reservas: 0, cubiertos: 0 };
  const cuposDia = porDia.get(diaSel) ?? { reservas: 0, cubiertos: 0 };

  const irAMes = (delta: number) => {
    const [y, m] = mesKey.split('-').map(Number);
    const destino = new Date(y, m - 1 + delta, 1);
    router.push(`/admin/reservas?fecha=${toYMD(destino)}`);
  };

  const busyId =
    (cambiarEstado.isPending && cambiarEstado.variables?.id) ||
    (sentar.isPending && sentar.variables?.id) ||
    null;

  const subtituloHeader =
    `${plural(cuposHoy.reservas, 'reserva hoy', 'reservas hoy')} · ${plural(cuposHoy.cubiertos, 'cubierto', 'cubiertos')}` +
    (config.maxReservasPorDia ? ` · cupo ${cuposHoy.reservas}/${config.maxReservasPorDia}` : '');

  const crearReserva = async (datos: NuevaReservaDatos) => {
    try {
      await crear.mutateAsync(datos);
      return true;
    } catch {
      return false;
    }
  };

  // Salta a un día con reservas: dentro del mes basta seleccionarlo; en otro mes
  // navegamos por URL para que el server recargue ese mes.
  const irADia = (ymd: string, otroMes: boolean) => {
    if (otroMes) router.push(`/admin/reservas?fecha=${ymd}`);
    else setDiaSel(ymd);
  };

  const renderSalto = (
    destino: { ymd: string; otroMes: boolean },
    label: string,
    sentido: 'anterior' | 'proximo',
  ) => (
    <Button variant="outline" size="sm" onClick={() => irADia(destino.ymd, destino.otroMes)}>
      {sentido === 'anterior' && <ArrowLeft />}
      {label}
      <span className="text-muted-foreground">
        · {destino.otroMes ? diaLegibleLargo(destino.ymd) : diaLegible(destino.ymd)}
      </span>
      {sentido === 'proximo' && <ArrowRight />}
    </Button>
  );

  const renderReserva = (r: Reserva) => (
    <ReservaCard
      key={r.id}
      reserva={r}
      chosenMesa={mesaElegida[r.id] ?? null}
      busy={busyId === r.id}
      onConfirmar={(res) => cambiarEstado.mutate({ id: res.id, estado: 'Confirmada' })}
      onSentar={(res) => {
        const m = mesaElegida[res.id];
        if (m) sentar.mutate({ id: res.id, mesaId: m.id });
      }}
      onMarcarCumplida={(res) => cambiarEstado.mutate({ id: res.id, estado: 'Cumplida' })}
      onPedirConfirmacion={(res, accion) => setConfirmTarget({ reserva: res, accion })}
      onElegirMesa={(reservaId, mesaId, label) =>
        setMesaElegida((prev) => ({ ...prev, [reservaId]: { id: mesaId, label } }))
      }
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reservas</h1>
          <p className="text-sm text-muted-foreground">{subtituloHeader}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings /> Configuración
          </Button>
          <Button onClick={() => setNuevaOpen(true)}>
            <Plus /> Nueva reserva
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <ReservasCalendar
          mesKey={mesKey}
          diaSel={diaSel}
          hoy={hoy}
          porDia={porDia}
          maxReservasPorDia={config.maxReservasPorDia}
          onSelectDia={setDiaSel}
          onCambiarMes={irAMes}
        />

        {/* Agenda del día */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">{diaLegibleLargo(diaSel)}</h2>
            <p className="text-[13px] text-muted-foreground">
              {plural(cuposDia.reservas, 'reserva', 'reservas')} ·{' '}
              {plural(cuposDia.cubiertos, 'cubierto', 'cubiertos')}
            </p>
          </div>

          {reservasDelDia.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-10 text-center">
              <p className="text-muted-foreground">No hay reservas para este día.</p>
              {proximoDiaEnMes ? (
                <Button variant="outline" size="sm" onClick={() => setDiaSel(proximoDiaEnMes)}>
                  Próximo día con reservas
                  <span className="text-muted-foreground">· {diaLegible(proximoDiaEnMes)}</span>
                  <ArrowRight />
                </Button>
              ) : proximoDiaOtroMes ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/reservas?fecha=${proximoDiaOtroMes}`)}
                >
                  Próximo día con reservas
                  <span className="text-muted-foreground">· {diaLegibleLargo(proximoDiaOtroMes)}</span>
                  <ArrowRight />
                </Button>
              ) : buscandoProxima ? (
                <p className="text-xs text-muted-foreground">Buscando próximas reservas…</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              {gruposDia.map((g) => (
                <section key={g.key} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2 border-b pb-1.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{g.titulo}</h3>
                      {g.rango && (
                        <span className="text-xs tabular-nums text-muted-foreground">{g.rango}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {plural(g.reservas.length, 'reserva', 'reservas')} · {g.cubiertos}
                      {config.cupoCubiertosPorTurno && g.key !== '__otros__'
                        ? `/${config.cupoCubiertosPorTurno}`
                        : ''}{' '}
                      cubiertos
                    </span>
                  </div>
                  <div className="space-y-3">{g.reservas.map(renderReserva)}</div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <NuevaReservaDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        config={config}
        fechaDefault={diaSel}
        creando={crear.isPending}
        onCrear={crearReserva}
      />

      <ReservasConfigDrawer open={configOpen} onOpenChange={setConfigOpen} config={config} />

      <CancelarReservaDialog
        target={confirmTarget}
        pending={cambiarEstado.isPending}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        onConfirm={() => {
          if (!confirmTarget) return;
          cambiarEstado.mutate({ id: confirmTarget.reserva.id, estado: confirmTarget.accion });
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}
