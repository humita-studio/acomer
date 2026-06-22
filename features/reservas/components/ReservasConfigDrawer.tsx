'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { actualizarReservasConfigAction } from '../reservasConfigActions';
import {
  ANTICIPACION_OPCIONES,
  DURACION_OPCIONES,
  type ReservasConfig,
  type Turno,
} from '../reservasConfig';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

/** Drawer lateral con la configuración de reservas (cupos, turnos, anticipación). */
export function ReservasConfigDrawer({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ReservasConfig;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(config.activo);
  const [turnos, setTurnos] = useState<Turno[]>(config.turnos);
  const [duracion, setDuracion] = useState(config.duracionMinDefault);
  const [anticipacion, setAnticipacion] = useState(config.anticipacionMinMin);
  const [cubiertos, setCubiertos] = useState(config.cupoCubiertosPorTurno ?? 0);

  // Re-sembrar el form al abrir (patrón "ajustar estado en render", sin efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setActivo(config.activo);
      setTurnos(config.turnos);
      setDuracion(config.duracionMinDefault);
      setAnticipacion(config.anticipacionMinMin);
      setCubiertos(config.cupoCubiertosPorTurno ?? 0);
    }
  }

  const updateTurno = (i: number, partial: Partial<Turno>) =>
    setTurnos((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...partial } : t)));
  const addTurno = () =>
    setTurnos((ts) => [...ts, { nombre: 'Nuevo turno', desde: '12:00', hasta: '15:00', activo: true }]);
  const removeTurno = (i: number) => setTurnos((ts) => ts.filter((_, idx) => idx !== i));

  const guardar = useMutation({
    mutationFn: async () => {
      const res = await actualizarReservasConfigAction({
        activo,
        turnos,
        duracionMinDefault: duracion,
        anticipacionMinMin: anticipacion,
        cupoCubiertosPorTurno: cubiertos > 0 ? cubiertos : null,
        maxReservasPorDia: config.maxReservasPorDia,
      });
      if (!res.success) throw new Error(res.message ?? 'No se pudo guardar');
      return res;
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      onOpenChange(false);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Configuración de reservas</SheetTitle>
          <SheetDescription>Cupos, turnos y anticipación.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {/* Capacidad por turno */}
          <div className="space-y-2">
            <SectionLabel>Capacidad por turno</SectionLabel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Cubiertos máximos</p>
                <p className="text-xs text-muted-foreground">
                  {cubiertos > 0 ? 'Tope de cubiertos por turno' : 'Sin límite'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCubiertos((n) => Math.max(0, n - 5))}
                  aria-label="Menos cubiertos"
                >
                  <Minus />
                </Button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">
                  {cubiertos > 0 ? cubiertos : '∞'}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCubiertos((n) => n + 5)}
                  aria-label="Más cubiertos"
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>

          {/* Turnos */}
          <div className="space-y-2">
            <SectionLabel>Turnos</SectionLabel>
            <div className="space-y-2">
              {turnos.map((t, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={t.nombre}
                      onChange={(e) => updateTurno(i, { nombre: e.target.value })}
                      className="h-8 flex-1"
                      placeholder="Nombre del turno"
                    />
                    <Switch
                      checked={t.activo}
                      onCheckedChange={(v) => updateTurno(i, { activo: v })}
                      aria-label={`Activar ${t.nombre}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeTurno(i)}
                      aria-label={`Quitar ${t.nombre}`}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={t.desde}
                      onChange={(e) => updateTurno(i, { desde: e.target.value })}
                      className="h-8"
                    />
                    <span className="text-sm text-muted-foreground">—</span>
                    <Input
                      type="time"
                      value={t.hasta}
                      onChange={(e) => updateTurno(i, { hasta: e.target.value })}
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={addTurno}>
                <Plus /> Agregar turno
              </Button>
            </div>
          </div>

          {/* Duración */}
          <div className="space-y-2">
            <SectionLabel>Duración de reserva</SectionLabel>
            <Select value={String(duracion)} onValueChange={(v) => setDuracion(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURACION_OPCIONES.map((o) => (
                  <SelectItem key={o.min} value={String(o.min)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Anticipación mínima */}
          <div className="space-y-2">
            <SectionLabel>Anticipación mínima</SectionLabel>
            <Select value={String(anticipacion)} onValueChange={(v) => setAnticipacion(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANTICIPACION_OPCIONES.map((o) => (
                  <SelectItem key={o.min} value={String(o.min)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reservas online */}
          <div className="space-y-2">
            <SectionLabel>Reservas online</SectionLabel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Aceptar reservas desde la web</p>
                <p className="text-xs text-muted-foreground">Los clientes reservan desde tu carta.</p>
              </div>
              <Switch checked={activo} onCheckedChange={setActivo} aria-label="Aceptar reservas web" />
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button className="w-full" onClick={() => guardar.mutate()} disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
