'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  CheckCheck,
  Loader2,
  Users,
} from 'lucide-react';
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

function telefonoOk(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export function ReservarForm({
  tenantSlug,
  turnos,
  anticipacionMinMin = 0,
}: {
  tenantSlug: string;
  turnos?: TurnoSlots[];
  anticipacionMinMin?: number;
}) {
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
  const [copiado, setCopiado] = useState(false);

  const inicioISO = new Date(`${toYMD(fecha)}T${hora}:00`).toISOString();

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
      crearReservaAction(tenantSlug, {
        nombreContacto: nombre,
        telefono,
        inicioISO,
        personas,
        notas,
      }),
    onSuccess: (res) => {
      if (!res.success) setError(res.message ?? 'No se pudo crear la reserva');
    },
    onError: () => {
      setError('Sin conexión o error de red. Revisá internet e intentá de nuevo.');
    },
  });

  const handleConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) {
      setError('Ingresá tu nombre.');
      return;
    }
    if (!telefonoOk(telefono)) {
      setError('Ingresá un teléfono válido (ej. 11 2345 6789).');
      return;
    }
    if (!hayLugar) {
      setError('Elegí un día y horario con lugar disponible.');
      return;
    }
    crear.mutate();
  };

  if (crear.isSuccess && crear.data?.success) {
    const resumen = [
      fechaLegible(fecha),
      `a las ${hora}`,
      `${personas} ${personas === 1 ? 'persona' : 'personas'}`,
      nombre.trim(),
      telefono.trim(),
    ].join(' · ');
    const refCorta = crear.data.reservaId
      ? `#${crear.data.reservaId.slice(0, 6).toUpperCase()}`
      : null;

    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-5 text-center">
        <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-8 shadow-sm">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              ¡Reserva enviada!
            </h1>
            <p className="text-sm text-muted-foreground">
              El local ya la recibió. Te van a confirmar a la brevedad
              {nombre.trim() ? `, ${nombre.trim()}` : ''}.
            </p>
          </div>

          <dl className="space-y-2 rounded-xl bg-muted/60 p-4 text-left text-sm">
            {refCorta ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Referencia</dt>
                <dd className="font-mono font-medium">{refCorta}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Cuándo</dt>
              <dd className="text-right font-medium">
                {fechaLegible(fecha)} · {hora}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Personas</dt>
              <dd className="font-medium tabular-nums">{personas}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">A nombre de</dt>
              <dd className="truncate font-medium">{nombre.trim()}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            Guardá el detalle por si el local te llama para confirmar.
          </p>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `Reserva${refCorta ? ` ${refCorta}` : ''}: ${resumen}`,
                  );
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                } catch {
                  // ignore
                }
              }}
            >
              {copiado ? (
                <>
                  <CheckCheck className="size-4" aria-hidden />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden />
                  Copiar detalle
                </>
              )}
            </Button>
            <Button asChild className="w-full">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const puedeConfirmar =
    hayLugar && nombre.trim().length >= 2 && telefonoOk(telefono);

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur">
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

      <div className="mx-auto max-w-md p-4 sm:p-5">
        <form
          onSubmit={handleConfirmar}
          className="space-y-4 rounded-2xl border bg-card p-5 pt-6 shadow-sm"
        >
          <div className="text-center">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Reservá tu mesa
            </h2>
            <p className="text-sm text-muted-foreground">
              Elegí día, horario y personas
              {anticipacionMinMin > 0
                ? ` · mínimo ${anticipacionMinMin} min de anticipación`
                : ''}
            </p>
          </div>

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
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5 opacity-60" aria-hidden />
                        {n}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {consultando && (
            <div className="flex items-center gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              Consultando disponibilidad…
            </div>
          )}
          {consultado && hayLugar && (
            <div className="flex items-center gap-2.5 rounded-lg bg-success-subtle px-3.5 py-3 text-sm text-success-foreground">
              <CheckCircle2 className="size-4 shrink-0" />
              Hay lugar. Completá tus datos para reservar.
            </div>
          )}
          {consultado && !hayLugar && (
            <div className="flex items-center gap-2.5 rounded-lg bg-warning-subtle px-3.5 py-3 text-sm text-warning-foreground">
              <AlertCircle className="size-4 shrink-0" />
              {(motivo && MENSAJE_SIN_LUGAR[motivo]) ?? MENSAJE_SIN_LUGAR.sin_mesa}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rv-nombre" className="text-xs tracking-[0.2px] text-muted-foreground">
              Nombre
            </Label>
            <Input
              id="rv-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
              placeholder="Tu nombre"
              className="text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-tel" className="text-xs tracking-[0.2px] text-muted-foreground">
              Teléfono
            </Label>
            <Input
              id="rv-tel"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
              placeholder="Ej: 11 2345 6789"
              className="text-base"
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
              className="text-base"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={!puedeConfirmar || crear.isPending}
            className="h-12 w-full text-base"
          >
            {crear.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reservando…
              </>
            ) : (
              'Confirmar reserva'
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            El local te confirmará la reserva. No es un pago.
          </p>
        </form>
      </div>
    </div>
  );
}
