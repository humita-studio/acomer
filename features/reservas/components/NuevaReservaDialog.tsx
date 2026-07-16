'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { expandirTurnos, type ReservasConfig } from '../reservasConfig';

export type NuevaReservaDatos = {
  nombreContacto: string;
  telefono: string;
  inicioISO: string;
  personas: number;
  duracionMin: number;
  notas?: string;
};

const PERSONAS_OPCIONES = Array.from({ length: 16 }, (_, i) => i + 1);

/** Modal para que el staff cargue una reserva manual (teléfono / mostrador). */
export function NuevaReservaDialog({
  open,
  onOpenChange,
  config,
  fechaDefault,
  creando,
  onCrear,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ReservasConfig;
  fechaDefault: string;
  creando: boolean;
  /** Devuelve true si se creó; o un string con el error del servidor. */
  onCrear: (datos: NuevaReservaDatos) => Promise<true | string>;
}) {
  const turnosActivos = useMemo(() => config.turnos.filter((t) => t.activo), [config.turnos]);
  const slotsDe = (nombre: string) => {
    const t = turnosActivos.find((x) => x.nombre === nombre);
    return t ? expandirTurnos([t]) : [];
  };

  const [fecha, setFecha] = useState(fechaDefault);
  const [turnoNombre, setTurnoNombre] = useState(turnosActivos[0]?.nombre ?? '');
  const [hora, setHora] = useState(() => slotsDe(turnosActivos[0]?.nombre ?? '')[0] ?? '');
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const horarios = slotsDe(turnoNombre);

  // Reset al abrir: patrón "ajustar estado en render" (evita setState-en-efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const t0 = turnosActivos[0]?.nombre ?? '';
      setFecha(fechaDefault);
      setTurnoNombre(t0);
      setHora(slotsDe(t0)[0] ?? '');
      setPersonas(2);
      setNombre('');
      setTelefono('');
      setNotas('');
      setError(null);
    }
  }

  const cambiarTurno = (v: string) => {
    setTurnoNombre(v);
    setHora(slotsDe(v)[0] ?? '');
  };

  const submit = async () => {
    setError(null);
    if (!fecha) return setError('Elegí una fecha');
    if (!hora) return setError('Elegí un horario');
    if (!nombre.trim() || !telefono.trim()) return setError('Nombre y teléfono son obligatorios');
    const inicio = new Date(`${fecha}T${hora}:00`);
    if (Number.isNaN(inicio.getTime())) return setError('Fecha u horario inválidos');

    const result = await onCrear({
      nombreContacto: nombre.trim(),
      telefono: telefono.trim(),
      inicioISO: inicio.toISOString(),
      personas,
      duracionMin: config.duracionMinDefault,
      notas: notas.trim() || undefined,
    });
    if (result === true) onOpenChange(false);
    else setError(result || 'No se pudo crear la reserva');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
          <DialogDescription>Cargá los datos del cliente y el turno.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nr-fecha">Fecha</Label>
              <Input id="nr-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Turno</Label>
              <Select value={turnoNombre} onValueChange={cambiarTurno}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Turno" />
                </SelectTrigger>
                <SelectContent>
                  {turnosActivos.map((t) => (
                    <SelectItem key={t.nombre} value={t.nombre}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Hora" />
                </SelectTrigger>
                <SelectContent>
                  {horarios.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Personas</Label>
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

          <div className="space-y-1.5">
            <Label htmlFor="nr-nombre">Nombre del cliente</Label>
            <Input
              id="nr-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Laura Méndez"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nr-tel">Teléfono</Label>
            <Input
              id="nr-tel"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 9 11 …"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nr-nota">Nota (opcional)</Label>
            <Textarea
              id="nr-nota"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. cumpleaños, traen torta"
              rows={2}
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={creando}>
            {creando ? 'Creando…' : 'Crear reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
