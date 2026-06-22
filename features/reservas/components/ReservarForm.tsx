'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Calendar } from '@/shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { queryKeys } from '@/shared/query/keys';
import { getDisponibilidadAction, crearReservaAction } from '../reservasActions';
import { RESERVAS_CONFIG_DEFAULT, turnosConSlots, type TurnoSlots } from '../reservasConfig';
import { toYMD } from '../fechas';

const GRUPOS_FALLBACK = turnosConSlots(RESERVAS_CONFIG_DEFAULT.turnos);
const PERSONAS_OPCIONES = Array.from({ length: 12 }, (_, i) => i + 1);

const MENSAJE_SIN_LUGAR: Record<string, string> = {
  inactivo: 'Por el momento no estamos tomando reservas online.',
  anticipacion: 'Ese horario es demasiado pronto. Elegí una fecha con más anticipación.',
  cupo_dia: 'Ya no quedan reservas disponibles para ese día. Probá otra fecha.',
  cupo_turno: 'Ese turno está completo. Probá otro horario.',
  sin_mesa: 'No hay mesas disponibles para ese horario. Probá otro día u horario.',
};

function fechaLegible(d: Date) {
  const txt = format(d, "EEE d 'de' MMMM", { locale: es });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function ReservarForm({ tenantSlug, turnos }: { tenantSlug: string; turnos?: TurnoSlots[] }) {
  const grupos = turnos && turnos.length > 0 ? turnos : GRUPOS_FALLBACK;
  const slots = grupos.flatMap((g) => g.slots);
  const [fecha, setFecha] = useState<Date>(() => startOfToday());
  const [fechaOpen, setFechaOpen] = useState(false);
  const [hora, setHora] = useState(slots[0] ?? '');
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inicioISO = new Date(`${toYMD(fecha)}T${hora}:00`).toISOString();

  // Disponibilidad reactiva: la key cambia con fecha/horario/personas, así que se
  // reconsulta sola al tocar cualquier parámetro (sin botón "ver disponibilidad").
  const disponibilidad = useQuery({
    queryKey: queryKeys.disponibilidad(inicioISO, personas),
    queryFn: () => getDisponibilidadAction(tenantSlug, inicioISO, personas),
    staleTime: 30_000,
  });

  const consultando = disponibilidad.isFetching;
  const consultado = disponibilidad.isFetched && !consultando;
  const hayLugar = !!disponibilidad.data?.success && (disponibilidad.data.mesas?.length ?? 0) > 0;
  const motivo = (disponibilidad.data as { motivo?: string } | undefined)?.motivo;

  const crear = useMutation({
    mutationFn: () =>
      crearReservaAction(tenantSlug, { nombreContacto: nombre, telefono, inicioISO, personas, notas }),
    onSuccess: (res) => {
      if (!res.success) setError(res.message ?? 'No se pudo crear la reserva');
    },
  });

  const handleConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim() || !telefono.trim()) {
      setError('Completá tu nombre y teléfono');
      return;
    }
    crear.mutate();
  };

  if (crear.isSuccess && crear.data?.success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-5 text-center">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-foreground">¡Reserva enviada!</h1>
          <p className="mt-2 text-muted-foreground">
            Te confirmaremos la reserva a la brevedad. ¡Gracias {nombre.trim() || 'por reservar'}!
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  const puedeConfirmar = hayLugar && nombre.trim().length > 0 && telefono.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-card px-4">
        <Link
          href="/"
          aria-label="Volver"
          className="flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold text-foreground">Reservar</h1>
        <span className="size-9" aria-hidden />
      </header>

      <div className="mx-auto max-w-md p-5">
        <form
          onSubmit={handleConfirmar}
          className="space-y-[18px] rounded-2xl border bg-card p-5 pt-7 shadow-sm"
        >
          <div className="text-center">
            <h2 className="text-base font-semibold text-foreground">Reservá tu mesa</h2>
            <p className="text-[13px] text-muted-foreground">Elegí día, horario y personas</p>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-[0.2px] text-muted-foreground">Fecha</Label>
            <Popover open={fechaOpen} onOpenChange={setFechaOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border bg-card px-3.5 py-3 text-sm text-foreground transition-colors hover:bg-muted/40"
                >
                  {fechaLegible(fecha)}
                  <CalendarDays className="size-[18px] text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={(d) => {
                    if (d) setFecha(d);
                    setFechaOpen(false);
                  }}
                  locale={es}
                  defaultMonth={fecha}
                  disabled={{ before: startOfToday() }}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Horario + Personas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs tracking-[0.2px] text-muted-foreground">Horario</Label>
              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => (
                    <SelectGroup key={g.nombre}>
                      <SelectLabel>{g.nombre}</SelectLabel>
                      {g.slots.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-[0.2px] text-muted-foreground">Personas</Label>
              <Select value={String(personas)} onValueChange={(v) => setPersonas(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAS_OPCIONES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Disponibilidad */}
          {consultando && (
            <div className="flex items-center gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
              <Loader2 className="size-[18px] shrink-0 animate-spin" />
              Consultando disponibilidad…
            </div>
          )}
          {consultado && hayLugar && (
            <div className="flex items-center gap-2.5 rounded-lg bg-success-subtle px-3.5 py-3 text-[13px] text-success-foreground">
              <CheckCircle2 className="size-[18px] shrink-0" />
              ¡Hay lugar! Completá tus datos para reservar.
            </div>
          )}
          {consultado && !hayLugar && (
            <div className="flex items-center gap-2.5 rounded-lg bg-warning-subtle px-3.5 py-3 text-[13px] text-warning-foreground">
              <AlertCircle className="size-[18px] shrink-0" />
              {(motivo && MENSAJE_SIN_LUGAR[motivo]) ?? MENSAJE_SIN_LUGAR.sin_mesa}
            </div>
          )}

          {/* Datos del cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="rv-nombre" className="text-xs tracking-[0.2px] text-muted-foreground">
              Nombre
            </Label>
            <Input
              id="rv-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-tel" className="text-xs tracking-[0.2px] text-muted-foreground">
              Teléfono
            </Label>
            <Input
              id="rv-tel"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 11 2345 6789"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-notas" className="text-xs tracking-[0.2px] text-muted-foreground">
              Notas (opcional)
            </Label>
            <Input
              id="rv-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: festejo de cumpleaños"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!puedeConfirmar || crear.isPending}
            className="w-full bg-success text-primary-foreground hover:bg-success/90"
          >
            {crear.isPending ? 'Reservando…' : 'Confirmar reserva'}
          </Button>
        </form>
      </div>
    </div>
  );
}
