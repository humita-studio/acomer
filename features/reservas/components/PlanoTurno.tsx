'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Loader2, MapPinOff, Users } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import { queryKeys } from '@/shared/query/keys';
import { getPlanoDataAction } from '@/features/mesas/plano-actions';
import {
  COLS,
  GRID_PX,
  MIN_CELL,
  ROWS,
  type ElementoPlanoUI,
  type MesaPlano,
} from '@/features/mesas/components/plano-types';
import { estadoMeta } from '../estados';
import { horaDe, hhmm } from '../fechas';
import { turnoDeHora, type ReservasConfig } from '../reservasConfig';
import type { Reserva } from '../types';

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

// Estados que pintamos en el plano (el resto no “ocupan” mesa en el turno).
const ESTADOS_VISIBLES = new Set(['Pendiente', 'Confirmada', 'Sentada']);

function estiloMesaPorEstado(estado: string | null, seleccionada: boolean) {
  if (!estado) {
    return seleccionada
      ? 'border-success bg-success-subtle ring-2 ring-success/30 text-success-foreground'
      : 'border-success/40 bg-success-subtle/80 text-success-foreground hover:ring-2 hover:ring-success/25';
  }
  if (estado === 'Sentada') {
    return seleccionada
      ? 'border-success bg-success text-primary-foreground ring-2 ring-success/40'
      : 'border-success/60 bg-success/90 text-primary-foreground hover:ring-2 hover:ring-success/35';
  }
  if (estado === 'Confirmada') {
    return seleccionada
      ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/40'
      : 'border-primary/55 bg-primary/90 text-primary-foreground hover:ring-2 hover:ring-primary/30';
  }
  // Pendiente
  return seleccionada
    ? 'border-warning bg-warning text-warning-foreground ring-2 ring-warning/40'
    : 'border-warning/55 bg-warning/90 text-warning-foreground hover:ring-2 hover:ring-warning/30';
}

/**
 * Plano del salón con las reservas del día/turno pintadas sobre las mesas.
 * Click en mesa con reserva → reasignar; lista lateral de sin mesa.
 */
export function PlanoTurno({
  tenantId,
  reservasDelDia,
  config,
  onAsignarMesa,
  onNuevaReserva,
}: {
  tenantId: string;
  reservasDelDia: Reserva[];
  config: ReservasConfig;
  onAsignarMesa: (r: Reserva) => void;
  onNuevaReserva?: () => void;
}) {
  const turnosActivos = useMemo(
    () =>
      [...config.turnos]
        .filter((t) => t.activo)
        .sort((a, b) => (a.desde > b.desde ? 1 : -1)),
    [config.turnos],
  );

  const [turnoKey, setTurnoKey] = useState<string>(() => turnosActivos[0]?.nombre ?? '__todos__');
  const [ambienteId, setAmbienteId] = useState<string | 'all'>('all');
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  const { data: plano, isFetching } = useQuery({
    queryKey: queryKeys.plano(tenantId),
    queryFn: getPlanoDataAction,
    staleTime: 60_000,
  });

  const ambientes = plano?.ambientes ?? [];
  const mesasPlano: MesaPlano[] = useMemo(
    () => (plano?.mesas ?? []).filter((m) => !m.parentMesaId),
    [plano?.mesas],
  );

  // Al cargar ambientes, si hay uno solo lo fijamos; si no, "all".
  const [planoListo, setPlanoListo] = useState(false);
  if (plano && !planoListo) {
    setPlanoListo(true);
    if (ambientes.length === 1) setAmbienteId(ambientes[0].id);
  }

  const reservasTurno = useMemo(() => {
    return reservasDelDia.filter((r) => {
      if (!ESTADOS_VISIBLES.has(r.estado)) return false;
      if (turnoKey === '__todos__') return true;
      const t = turnoDeHora(config.turnos, hhmm(r.inicio));
      return t?.nombre === turnoKey;
    });
  }, [reservasDelDia, turnoKey, config.turnos]);

  const porMesa = useMemo(() => {
    const map = new Map<string, Reserva[]>();
    for (const r of reservasTurno) {
      if (!r.mesaId) continue;
      const list = map.get(r.mesaId) ?? [];
      list.push(r);
      map.set(r.mesaId, list);
    }
    // Orden horario dentro de la mesa (turnos largos / varias franjas).
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    }
    return map;
  }, [reservasTurno]);

  const sinMesa = useMemo(
    () => reservasTurno.filter((r) => !r.mesaId),
    [reservasTurno],
  );

  const mesasAmbiente = useMemo(() => {
    if (ambienteId === 'all') return mesasPlano;
    return mesasPlano.filter((m) => m.ambienteId === ambienteId);
  }, [mesasPlano, ambienteId]);

  const elementosAmbiente: ElementoPlanoUI[] = useMemo(() => {
    const els = (plano?.elementos ?? []) as ElementoPlanoUI[];
    if (ambienteId === 'all') return els;
    return els.filter((e) => e.ambienteId === ambienteId);
  }, [plano?.elementos, ambienteId]);

  const cubiertosAsignados = reservasTurno
    .filter((r) => r.mesaId)
    .reduce((s, r) => s + r.cantidadPersonas, 0);
  const cubiertosSinMesa = sinMesa.reduce((s, r) => s + r.cantidadPersonas, 0);

  const reservaSeleccionada = seleccionId
    ? reservasTurno.find((r) => r.id === seleccionId) ?? null
    : null;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(GRID_PX);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const c = clamp(Math.floor(el.clientWidth / COLS), MIN_CELL, GRID_PX);
      setCell(c);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = COLS * cell;
  const height = ROWS * cell;

  if (isFetching && !plano) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando plano del salón…
      </div>
    );
  }

  if (mesasPlano.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card py-12 text-center">
        <LayoutGrid className="size-8 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="font-medium">No hay mesas en el plano</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Armá el salón en Admin → Mesas para ver y asignar reservas acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={turnoKey} onValueChange={setTurnoKey}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todo el día</SelectItem>
              {turnosActivos.map((t) => (
                <SelectItem key={t.nombre} value={t.nombre}>
                  {t.nombre}
                  <span className="text-muted-foreground">
                    {' '}
                    · {t.desde}–{t.hasta}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {ambientes.length > 1 ? (
            <Select value={ambienteId} onValueChange={(v) => setAmbienteId(v)}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Ambiente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ambientes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {reservasTurno.length} res. · {cubiertosAsignados} en mesa
          {cubiertosSinMesa > 0 ? ` · ${cubiertosSinMesa} sin asignar` : ''}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(200px,240px)]">
        {/* Lienzo */}
        <div ref={wrapperRef} className="w-full overflow-auto rounded-xl border bg-muted/30">
          <div className="relative mx-auto" style={{ width, height, minHeight: 200 }}>
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: `radial-gradient(circle, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px)`,
                backgroundSize: `${cell}px ${cell}px`,
              }}
            />

            {elementosAmbiente.map((el) => {
              const esParedFina = el.tipo === 'pared' && el.alto <= 0.5;
              let estilo =
                'bg-[#3d3a36]/90 border border-[#2a2825] rounded-md opacity-70';
              if (el.tipo === 'barra') {
                estilo =
                  'bg-gradient-to-b from-[#9a7b55] to-[#7a5f40] border border-[#5c4630]/80 rounded-md opacity-80';
              } else if (el.tipo === 'contorno') {
                estilo =
                  'bg-transparent border-2 border-dashed border-border-strong rounded-md opacity-60';
              } else if (el.tipo === 'decoracion') {
                estilo = 'bg-success-subtle/60 border border-success/25 rounded-full opacity-70';
              } else if (esParedFina) {
                estilo = 'bg-[#3d3a36] border-0 rounded-full opacity-70';
              }
              return (
                <div
                  key={el.id}
                  className={cn('pointer-events-none absolute', estilo)}
                  style={{
                    left: el.posX * cell,
                    top: el.posY * cell,
                    width: el.ancho * cell,
                    height: el.alto * cell,
                    transform: `rotate(${el.rotacion}deg)`,
                  }}
                />
              );
            })}

            {mesasAmbiente.map((mesa) => {
              const lista = porMesa.get(mesa.id) ?? [];
              const principal = lista[0] ?? null;
              const extra = lista.length - 1;
              const esRedonda = mesa.forma === 'redonda';
              const sel =
                !!principal &&
                (seleccionId === principal.id || lista.some((r) => r.id === seleccionId));

              return (
                <button
                  key={mesa.id}
                  type="button"
                  onClick={() => {
                    if (principal) {
                      setSeleccionId(principal.id);
                    } else {
                      setSeleccionId(null);
                    }
                  }}
                  className={cn(
                    'absolute flex flex-col items-center justify-center overflow-hidden border-2 px-0.5 transition-all',
                    esRedonda ? 'rounded-full' : 'rounded-[28%]',
                    principal ? 'cursor-pointer' : 'cursor-default',
                    estiloMesaPorEstado(principal?.estado ?? null, sel),
                  )}
                  style={{
                    left: mesa.posX * cell,
                    top: mesa.posY * cell,
                    width: mesa.ancho * cell,
                    height: mesa.alto * cell,
                    transform: `rotate(${mesa.rotacion}deg)`,
                    zIndex: sel ? 6 : principal ? 3 : 1,
                  }}
                  title={
                    principal
                      ? `Mesa ${mesa.identificador} · ${principal.nombreContacto} · ${horaDe(principal.inicio)} · ${principal.cantidadPersonas}p`
                      : `Mesa ${mesa.identificador} · libre · ${mesa.capacidad} lugares`
                  }
                >
                  <span className="max-w-full truncate text-center text-[11px] font-semibold leading-tight opacity-90">
                    {mesa.identificador}
                  </span>
                  {principal ? (
                    <>
                      <span className="max-w-full truncate text-center text-[10px] font-medium leading-tight">
                        {principal.nombreContacto.split(' ')[0]}
                      </span>
                      <span className="text-[9px] tabular-nums opacity-90">
                        {horaDe(principal.inicio)}
                        {extra > 0 ? ` +${extra}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[10px] opacity-75">
                      <Users size={10} />
                      {mesa.capacidad}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-3">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success/80" /> Libre
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-warning" /> Pendiente
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" /> Confirmada
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" /> Sentada
            </li>
          </ul>

          {reservaSeleccionada ? (
            <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {reservaSeleccionada.nombreContacto}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {horaDe(reservaSeleccionada.inicio)} · {reservaSeleccionada.cantidadPersonas}{' '}
                    pers
                    {reservaSeleccionada.mesaIdentificador
                      ? ` · Mesa ${reservaSeleccionada.mesaIdentificador}`
                      : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    estadoMeta(reservaSeleccionada.estado).pill,
                  )}
                >
                  {estadoMeta(reservaSeleccionada.estado).label}
                </span>
              </div>
              {reservaSeleccionada.telefono ? (
                <p className="text-xs text-muted-foreground">{reservaSeleccionada.telefono}</p>
              ) : null}
              {reservaSeleccionada.notas ? (
                <p className="text-xs text-muted-foreground">{reservaSeleccionada.notas}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onAsignarMesa(reservaSeleccionada)}
                >
                  {reservaSeleccionada.mesaId ? 'Cambiar mesa' : 'Asignar mesa'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setSeleccionId(null)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card/50 p-3 text-xs text-muted-foreground">
              Tocá una mesa con reserva para ver el detalle y reasignar.
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sin mesa
              </p>
              <span className="text-xs tabular-nums text-muted-foreground">{sinMesa.length}</span>
            </div>
            {sinMesa.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todas tienen mesa en este turno.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {sinMesa.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSeleccionId(r.id);
                        onAsignarMesa(r);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted',
                        seleccionId === r.id && 'border-primary bg-primary/5',
                      )}
                    >
                      <MapPinOff className="size-3.5 shrink-0 text-warning" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.nombreContacto}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {horaDe(r.inicio)} · {r.cantidadPersonas}p
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {onNuevaReserva ? (
            <Button variant="outline" size="sm" className="w-full" onClick={onNuevaReserva}>
              Nueva reserva
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
