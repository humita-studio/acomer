'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, List, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
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
import { cn } from '@/shared/lib/utils';
import { queryKeys } from '@/shared/query/keys';
import { getPlanoDataAction } from '@/features/mesas/plano-actions';
import type { ElementoPlanoUI, MesaPlano } from '@/features/mesas/components/plano-types';
import { useMesasDisponibles } from '../hooks/useReservas';
import { horaDe } from '../fechas';
import type { Reserva } from '../types';
import { PlanoAsignacion, type MesaEstadoAsignacion } from './PlanoAsignacion';

/**
 * Diálogo para asignar mesa a una reserva: plano del salón + lista.
 * Persiste al confirmar (o al hacer click en una mesa libre del plano).
 */
export function AsignarMesaDialog({
  open,
  onOpenChange,
  reserva,
  tenantId,
  pending,
  onAsignar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva: Reserva | null;
  tenantId: string;
  pending?: boolean;
  onAsignar: (mesaId: string | null) => void | Promise<void>;
}) {
  const [vista, setVista] = useState<'plano' | 'lista'>('plano');
  const [ambienteId, setAmbienteId] = useState<string | 'all'>('all');

  const inicioISO = reserva ? new Date(reserva.inicio).toISOString() : '';
  const { data: mesasLibres = [], isFetching: cargandoLibres } = useMesasDisponibles({
    inicioISO,
    personas: reserva?.cantidadPersonas ?? 1,
    duracionMin: reserva?.duracionMin ?? 90,
    excluirReservaId: reserva?.id ?? null,
    enabled: open && !!reserva,
  });

  const { data: plano, isFetching: cargandoPlano } = useQuery({
    queryKey: queryKeys.plano(tenantId),
    queryFn: getPlanoDataAction,
    enabled: open,
    staleTime: 60_000,
  });

  const ambientes = plano?.ambientes ?? [];
  const mesasPlano: MesaPlano[] = useMemo(
    () =>
      (plano?.mesas ?? [])
        .filter((m) => !m.parentMesaId)
        .map((m) => ({
          ...m,
          forma: m.forma || 'cuadrada',
        })),
    [plano?.mesas],
  );

  // Ambiente activo: al abrir, preferir el de la mesa actual o el primero.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const mesaActual = mesasPlano.find((m) => m.id === reserva?.mesaId);
      if (mesaActual?.ambienteId) setAmbienteId(mesaActual.ambienteId);
      else if (ambientes[0]) setAmbienteId(ambientes[0].id);
      else setAmbienteId('all');
      setVista('plano');
    }
  }

  const mesasAmbiente = useMemo(() => {
    if (ambienteId === 'all') return mesasPlano;
    return mesasPlano.filter((m) => m.ambienteId === ambienteId);
  }, [mesasPlano, ambienteId]);

  const elementosAmbiente: ElementoPlanoUI[] = useMemo(() => {
    const els = (plano?.elementos ?? []) as ElementoPlanoUI[];
    if (ambienteId === 'all') return els;
    return els.filter((e) => e.ambienteId === ambienteId);
  }, [plano?.elementos, ambienteId]);

  const libresSet = useMemo(() => new Set(mesasLibres.map((m) => m.id)), [mesasLibres]);

  const estadoPorMesa = useMemo(() => {
    const map: Record<string, MesaEstadoAsignacion> = {};
    for (const m of mesasPlano) {
      if (reserva?.mesaId && m.id === reserva.mesaId) {
        map[m.id] = 'actual';
      } else if (libresSet.has(m.id)) {
        map[m.id] = 'libre';
      } else if (m.capacidad < (reserva?.cantidadPersonas ?? 1)) {
        map[m.id] = 'chica';
      } else {
        map[m.id] = 'ocupada';
      }
    }
    return map;
  }, [mesasPlano, libresSet, reserva?.mesaId, reserva?.cantidadPersonas]);

  if (!reserva) return null;

  const cargando = cargandoLibres || cargandoPlano;
  const mesaLabel = reserva.mesaIdentificador
    ? `Mesa ${reserva.mesaIdentificador}`
    : reserva.mesaId
      ? 'Mesa asignada'
      : 'Sin mesa';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle>Asignar mesa</DialogTitle>
          <DialogDescription>
            {reserva.nombreContacto} · {reserva.cantidadPersonas}{' '}
            {reserva.cantidadPersonas === 1 ? 'persona' : 'personas'} · {horaDe(reserva.inicio)} ·{' '}
            {mesaLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5">
          <div className="flex items-center gap-2">
            {ambientes.length > 1 ? (
              <Select value={ambienteId} onValueChange={(v) => setAmbienteId(v)}>
                <SelectTrigger className="h-8 w-[160px]">
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
            <p className="text-xs text-muted-foreground">
              {mesasLibres.length}{' '}
              {mesasLibres.length === 1 ? 'mesa libre' : 'mesas libres'} para este grupo
            </p>
          </div>
          <div className="flex rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setVista('plano')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                vista === 'plano' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              <LayoutGrid className="size-3.5" />
              Plano
            </button>
            <button
              type="button"
              onClick={() => setVista('lista')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                vista === 'lista' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              <List className="size-3.5" />
              Lista
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando salón…
            </div>
          ) : mesasPlano.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              No hay mesas en el plano. Crealas en{' '}
              <span className="font-medium text-foreground">Admin → Mesas</span>.
            </div>
          ) : vista === 'plano' ? (
            <div className="space-y-3">
              <PlanoAsignacion
                mesas={mesasAmbiente}
                elementos={elementosAmbiente}
                estadoPorMesa={estadoPorMesa}
                disabled={pending}
                onElegir={(id) => void onAsignar(id)}
              />
              <ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-success" /> Disponible
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary" /> Esta reserva
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-warning" /> Chica para el grupo
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-muted-foreground/40" /> Ocupada
                </li>
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {mesasLibres.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay mesas libres con capacidad para {reserva.cantidadPersonas} personas en
                  este horario.
                </p>
              ) : (
                mesasLibres.map((m) => {
                  const actual = reserva.mesaId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={pending}
                      onClick={() => void onAsignar(m.id)}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted',
                        actual && 'border-primary bg-primary/5',
                      )}
                    >
                      <span className="font-medium">Mesa {m.identificador}</span>
                      <span className="text-xs text-muted-foreground">{m.capacidad} lugares</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          <div>
            {reserva.mesaId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void onAsignar(null)}
              >
                Quitar mesa
              </Button>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
