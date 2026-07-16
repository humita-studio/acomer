'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCheck,
  Copy,
  ExternalLink,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Settings,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  useReservasMes,
  useReservasRealtime,
  useProximaReserva,
  useCambiarEstadoReserva,
  useSentarReserva,
  useAsignarMesaReserva,
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
import { AsignarMesaDialog } from './AsignarMesaDialog';
import { PlanoTurno } from './PlanoTurno';

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
  publicReservarUrl,
}: {
  tenantId: string;
  fecha: string;
  mesKey: string;
  desdeISO: string;
  hastaISO: string;
  initialReservas: Reserva[];
  config: ReservasConfig;
  publicReservarUrl?: string;
}) {
  const router = useRouter();
  const [diaSel, setDiaSel] = useState(fecha);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ reserva: Reserva; accion: AccionConfirmable } | null>(null);
  const [asignarTarget, setAsignarTarget] = useState<Reserva | null>(null);
  const [vistaDia, setVistaDia] = useState<'lista' | 'plano'>('lista');

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
  const asignarMesa = useAsignarMesaReserva(tenantId, mesKey);
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

  // Cuando el día elegido está vacío, ubicamos la próxima reserva para saltar.
  // Primero dentro del mes ya cargado; si no hay, consultamos al server.
  const diaVacio = reservasDelDia.length === 0;
  const proximoDiaEnMes = useMemo(() => {
    if (!diaVacio) return null;
    let proximo: string | null = null;
    for (const [ymd, info] of porDia) {
      if (info.reservas === 0) continue;
      if (ymd > diaSel && (proximo === null || ymd < proximo)) proximo = ymd;
    }
    return proximo;
  }, [porDia, diaSel, diaVacio]);

  const { data: proximaInicio, isFetching: buscandoProxima } = useProximaReserva({
    tenantId,
    desdeISO: hastaISO,
    enabled: diaVacio && proximoDiaEnMes === null,
  });
  const proximoDiaOtroMes = proximaInicio ? ymdDeReserva(proximaInicio) : null;

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
    (asignarMesa.isPending && asignarMesa.variables?.id) ||
    null;

  const subtituloHeader =
    `${plural(cuposHoy.reservas, 'reserva hoy', 'reservas hoy')} · ${plural(cuposHoy.cubiertos, 'cubierto', 'cubiertos')}` +
    (config.maxReservasPorDia ? ` · cupo ${cuposHoy.reservas}/${config.maxReservasPorDia}` : '') +
    (config.activo ? '' : ' · online apagado');

  const copiarLinkPublico = async () => {
    if (!publicReservarUrl) return;
    try {
      await navigator.clipboard.writeText(publicReservarUrl);
      setLinkCopiado(true);
      toast.success('Link de reservas copiado');
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  const crearReserva = async (datos: NuevaReservaDatos) => {
    try {
      await crear.mutateAsync(datos);
      return true as const;
    } catch (e) {
      return e instanceof Error ? e.message : 'No se pudo crear la reserva';
    }
  };

  const renderReserva = (r: Reserva) => (
    <ReservaCard
      key={r.id}
      reserva={r}
      busy={busyId === r.id}
      onConfirmar={(res) => cambiarEstado.mutate({ id: res.id, estado: 'Confirmada' })}
      onSentar={(res) => sentar.mutate({ id: res.id, mesaId: res.mesaId })}
      onMarcarCumplida={(res) => cambiarEstado.mutate({ id: res.id, estado: 'Cumplida' })}
      onPedirConfirmacion={(res, accion) => setConfirmTarget({ reserva: res, accion })}
      onAbrirAsignarMesa={setAsignarTarget}
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
        <div className="flex flex-wrap items-center gap-2">
          {publicReservarUrl ? (
            <Button variant="outline" size="sm" onClick={() => void copiarLinkPublico()}>
              {linkCopiado ? <CheckCheck className="size-4" /> : <Link2 className="size-4" />}
              {linkCopiado ? 'Link copiado' : 'Link público'}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings /> Configuración
          </Button>
          <Button onClick={() => setNuevaOpen(true)}>
            <Plus /> Nueva reserva
          </Button>
        </div>
      </div>

      {!config.activo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
          <p>
            Las reservas <strong>online están apagadas</strong>. El link público no toma
            pedidos; igual podés cargar reservas a mano.
          </p>
          <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
            Activar online
          </Button>
        </div>
      ) : null}

      {config.activo && publicReservarUrl && cuposHoy.reservas === 0 && reservas.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Compartí el link de reservas</p>
            <p className="text-sm text-muted-foreground">
              Tus clientes reservan en la web y aparecen acá en tiempo real.
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">{publicReservarUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copiarLinkPublico()}>
              {linkCopiado ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
              Copiar
            </Button>
            <Button type="button" size="sm" asChild>
              <a href={publicReservarUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Abrir
              </a>
            </Button>
          </div>
        </div>
      ) : null}

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold">{diaLegibleLargo(diaSel)}</h2>
              <p className="text-[13px] text-muted-foreground">
                {plural(cuposDia.reservas, 'reserva', 'reservas')} ·{' '}
                {plural(cuposDia.cubiertos, 'cubierto', 'cubiertos')}
              </p>
            </div>
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setVistaDia('lista')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  vistaDia === 'lista' ? 'bg-background shadow-sm' : 'text-muted-foreground',
                )}
              >
                <List className="size-3.5" />
                Lista
              </button>
              <button
                type="button"
                onClick={() => setVistaDia('plano')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  vistaDia === 'plano' ? 'bg-background shadow-sm' : 'text-muted-foreground',
                )}
              >
                <LayoutGrid className="size-3.5" />
                Plano
              </button>
            </div>
          </div>

          {vistaDia === 'plano' ? (
            <PlanoTurno
              tenantId={tenantId}
              reservasDelDia={reservasDelDia}
              config={config}
              onAsignarMesa={setAsignarTarget}
              onNuevaReserva={() => setNuevaOpen(true)}
            />
          ) : reservasDelDia.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-10 text-center">
              <p className="font-medium text-foreground">Sin reservas este día</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Cargá una a mano o esperá que entren por el link público.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setNuevaOpen(true)}>
                  <Plus className="size-4" />
                  Nueva reserva
                </Button>
                {proximoDiaEnMes ? (
                  <Button variant="outline" size="sm" onClick={() => setDiaSel(proximoDiaEnMes)}>
                    Próximo día
                    <span className="text-muted-foreground">· {diaLegible(proximoDiaEnMes)}</span>
                    <ArrowRight />
                  </Button>
                ) : proximoDiaOtroMes ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/reservas?fecha=${proximoDiaOtroMes}`)}
                  >
                    Próximo día
                    <span className="text-muted-foreground">· {diaLegibleLargo(proximoDiaOtroMes)}</span>
                    <ArrowRight />
                  </Button>
                ) : buscandoProxima ? (
                  <p className="text-xs text-muted-foreground">Buscando próximas reservas…</p>
                ) : null}
              </div>
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

      <AsignarMesaDialog
        open={!!asignarTarget}
        onOpenChange={(o) => !o && setAsignarTarget(null)}
        reserva={
          // Preferir la versión fresca del query (mesaId actualizado).
          asignarTarget
            ? (reservas.find((x) => x.id === asignarTarget.id) ?? asignarTarget)
            : null
        }
        tenantId={tenantId}
        pending={asignarMesa.isPending}
        onAsignar={async (mesaId) => {
          if (!asignarTarget) return;
          const res = await asignarMesa.mutateAsync({ id: asignarTarget.id, mesaId });
          if (res.success && mesaId) setAsignarTarget(null);
        }}
      />
    </div>
  );
}
