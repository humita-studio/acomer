'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Switch } from '@/shared/ui/switch';
import { Label } from '@/shared/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { guardarLandingConfigAction } from '../landingConfigActions';
import { ImagenLocalUploader } from './ImagenLocalUploader';
import { cn } from '@/shared/lib/utils';
import {
  COLORES_MARCA,
  DIAS_SEMANA,
  GRADIENTE_MARCA,
  type AccionesLanding,
  type ColorMarca,
  type HorarioDia,
  type LandingConfig,
  type RedesLanding,
} from '../landingConfig';

const ACCIONES_META: { key: keyof AccionesLanding; titulo: string; sub: string }[] = [
  { key: 'verCarta', titulo: 'Ver la carta', sub: 'Botón para explorar el menú (solo lectura)' },
  { key: 'pedirOnline', titulo: 'Pedir online', sub: 'Takeaway o delivery desde la web' },
  { key: 'reservar', titulo: 'Reservar una mesa', sub: 'Reservas online' },
  { key: 'qr', titulo: 'Aviso de QR en el local', sub: 'Tarjeta para escanear el QR de la mesa' },
];

/** Formulario de la landing pública del local (tab "Landing" en configuración). */
export function LandingConfigForm({ 
  initial,
  identidadSuperior 
}: { 
  initial: LandingConfig;
  identidadSuperior?: React.ReactNode;
}) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [sobre, setSobre] = useState(initial.sobre);
  const [direccion, setDireccion] = useState(initial.direccion);
  const [horarios, setHorarios] = useState<HorarioDia[]>(initial.horarios);
  const [acciones, setAcciones] = useState<AccionesLanding>(initial.acciones);
  const [colorMarca, setColorMarca] = useState<ColorMarca>(initial.colorMarca);
  const [redes, setRedes] = useState<RedesLanding>(initial.redes);

  const updateDia = (dow: number, partial: Partial<HorarioDia>) =>
    setHorarios((hs) => hs.map((h, i) => (i === dow ? { ...h, ...partial } : h)));
  
  const addTurno = (dow: number) => {
    setHorarios((hs) => hs.map((h, i) => {
      if (i !== dow) return h;
      return { ...h, turnos: [...h.turnos, { desde: '12:00', hasta: '00:00' }] };
    }));
  };

  const removeTurno = (dow: number, turnoIndex: number) => {
    setHorarios((hs) => hs.map((h, i) => {
      if (i !== dow) return h;
      return { ...h, turnos: h.turnos.filter((_, idx) => idx !== turnoIndex) };
    }));
  };

  const updateTurno = (dow: number, turnoIndex: number, partial: Partial<{ desde: string; hasta: string }>) => {
    setHorarios((hs) => hs.map((h, i) => {
      if (i !== dow) return h;
      return {
        ...h,
        turnos: h.turnos.map((t, idx) => idx === turnoIndex ? { ...t, ...partial } : t)
      };
    }));
  };

  const updateRed = (k: keyof RedesLanding, v: string) => setRedes((r) => ({ ...r, [k]: v }));

  const guardar = useMutation({
    mutationFn: async () => {
      const res = await guardarLandingConfigAction({
        descripcion,
        sobre,
        direccion,
        horarios,
        acciones,
        colorMarca,
        redes,
      });
      if (!res.success) throw new Error(res.message ?? 'No se pudo guardar');
      return res;
    },
    onSuccess: () => {
      toast.success('Landing guardada');
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Columna Izquierda: Identidad y Básicos */}
        <div className="space-y-6">
          {identidadSuperior}

          <ImagenLocalUploader imagenUrl={initial.imagenUrl} kind="cover" />
          <ImagenLocalUploader imagenUrl={initial.logoUrl} kind="logo" />

          {/* Identidad */}
          <Card>
            <CardHeader>
              <CardTitle>Descripción y ubicación</CardTitle>
              <CardDescription>Cómo se presenta tu local en la página de inicio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="landing-descripcion">Tagline</Label>
                <Textarea
                  id="landing-descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Cocina de barrio · Parrilla · Pastas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landing-sobre">Sobre el local</Label>
                <Textarea
                  id="landing-sobre"
                  value={sobre}
                  onChange={(e) => setSobre(e.target.value)}
                  maxLength={1200}
                  rows={4}
                  placeholder="Contá la historia del lugar, especialidades o lo que quieras que lean tus clientes…"
                />
                <p className="text-xs text-muted-foreground">{sobre.length}/1200</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="landing-direccion">Dirección</Label>
                <Input
                  id="landing-direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  maxLength={200}
                  placeholder="Av. Corrientes 1234"
                />
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
              <CardDescription>Qué tarjetas se muestran en la landing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ACCIONES_META.map(({ key, titulo, sub }) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{titulo}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <Switch
                    checked={acciones[key]}
                    onCheckedChange={(v) => setAcciones((a) => ({ ...a, [key]: v }))}
                    aria-label={titulo}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Apariencia */}
          <Card>
            <CardHeader>
              <CardTitle>Apariencia</CardTitle>
              <CardDescription>Color de marca del hero y los botones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COLORES_MARCA.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={colorMarca === c.value}
                    onClick={() => setColorMarca(c.value)}
                    className={cn(
                      'size-9 rounded-lg border-2 transition-transform',
                      colorMarca === c.value
                        ? 'scale-110 border-foreground ring-2 ring-ring ring-offset-2'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                    style={{ background: GRADIENTE_MARCA[c.value] }}
                  />
                ))}
              </div>
              <Select value={colorMarca} onValueChange={(v) => setColorMarca(v as ColorMarca)}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORES_MARCA.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Horarios y Contacto */}
        <div className="space-y-6">
          {/* Horarios */}
          <Card>
            <CardHeader>
              <CardTitle>Horarios de atención</CardTitle>
              <CardDescription>
                Definen el estado “Abierto/Cerrado” y el horario de hoy que muestra la landing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DIAS_SEMANA.map(({ dow, label }) => {
                const dia = horarios[dow];
                return (
                  <div
                    key={dow}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3"
                  >
                    <span className="w-24 text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!dia.cerrado}
                        onCheckedChange={(v) => updateDia(dow, { cerrado: !v })}
                        aria-label={`Abierto ${label}`}
                      />
                      <span className="w-14 text-xs text-muted-foreground">
                        {dia.cerrado ? 'Cerrado' : 'Abierto'}
                      </span>
                    </div>
                    {!dia.cerrado && (
                      <div className="ml-auto flex flex-col gap-2">
                        {dia.turnos.map((turno, tIdx) => (
                          <div key={tIdx} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={turno.desde}
                              onChange={(e) => updateTurno(dow, tIdx, { desde: e.target.value })}
                              className="h-8 w-28"
                              aria-label={`Apertura ${label}`}
                            />
                            <span className="text-sm text-muted-foreground">—</span>
                            <Input
                              type="time"
                              value={turno.hasta}
                              onChange={(e) => updateTurno(dow, tIdx, { hasta: e.target.value })}
                              className="h-8 w-28"
                              aria-label={`Cierre ${label}`}
                            />
                            {dia.turnos.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeTurno(dow, tIdx)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1 h-8 w-full text-xs"
                          onClick={() => addTurno(dow)}
                        >
                          <Plus className="mr-1 size-3" /> Agregar turno
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Redes */}
          <Card>
            <CardHeader>
              <CardTitle>Contacto y redes</CardTitle>
              <CardDescription>Se muestran como botones al pie de la landing. Opcional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="landing-whatsapp">WhatsApp</Label>
                <Input
                  id="landing-whatsapp"
                  value={redes.whatsapp}
                  onChange={(e) => updateRed('whatsapp', e.target.value)}
                  inputMode="tel"
                  placeholder="5491122334455 (con código de país)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landing-instagram">Instagram</Label>
                <Input
                  id="landing-instagram"
                  value={redes.instagram}
                  onChange={(e) => updateRed('instagram', e.target.value)}
                  placeholder="usuario (sin @)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landing-telefono">Teléfono</Label>
                <Input
                  id="landing-telefono"
                  value={redes.telefono}
                  onChange={(e) => updateRed('telefono', e.target.value)}
                  inputMode="tel"
                  placeholder="011 4567-8900"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
