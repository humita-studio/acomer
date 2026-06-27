'use client';

import { useState, useMemo, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { formatPeso } from '@/shared/lib/format';
import {
  useCobrosTablero,
  useCobrosRealtime,
  useAprobarCobro,
  useRechazarCobro,
} from '@/features/cobros/hooks/useCobros';
import type { TransaccionCobro } from '@/features/cobros/types';
import { CobroPendienteCard, CobroResueltoCard } from './CobroCard';
import { AprobarCobroDialog } from './AprobarCobroDialog';

type Filtro = 'todos' | 'efectivo' | 'tarjeta_fisica' | 'mercado_pago';

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_fisica', label: 'Tarjeta' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];

// Solo se puede arrastrar un cobro pendiente → aprobado o rechazado.
const DESTINOS_VALIDOS = ['Aprobado', 'Rechazado'] as const;

function esDestinoValido(tx: TransaccionCobro, destino: string): boolean {
  if (tx.estado !== 'Pendiente') return false;
  return (DESTINOS_VALIDOS as readonly string[]).includes(destino);
}

export function CobrosManager({
  initialTransacciones,
  tenantId,
}: {
  initialTransacciones: TransaccionCobro[];
  tenantId: string;
}) {
  const { data: transacciones = [] } = useCobrosTablero(tenantId, initialTransacciones);
  useCobrosRealtime(tenantId);

  const aprobarMutation = useAprobarCobro(tenantId);
  const rechazarMutation = useRechazarCobro(tenantId);

  const [aprobarTarget, setAprobarTarget] = useState<TransaccionCobro | null>(null);
  const [rechazarTarget, setRechazarTarget] = useState<TransaccionCobro | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [activeCard, setActiveCard] = useState<TransaccionCobro | null>(null);

  // Filtrar por método de pago
  const filtradas = useMemo(() => {
    if (filtro === 'todos') return transacciones;
    return transacciones.filter((tx) => tx.proveedor === filtro);
  }, [transacciones, filtro]);

  // Agrupar por estado
  const pendientes = useMemo(() => filtradas.filter((tx) => tx.estado === 'Pendiente'), [filtradas]);
  const aprobados = useMemo(() => filtradas.filter((tx) => tx.estado === 'Aprobado'), [filtradas]);
  const rechazados = useMemo(() => filtradas.filter((tx) => tx.estado === 'Rechazado'), [filtradas]);

  const totalPorConfirmar = pendientes.reduce((acc, tx) => acc + Number(tx.monto), 0);

  // ── Doble confirmación ────────────────────────────────────────────────
  // Tanto el click en los botones de la card como el drag & drop abren el
  // modal de confirmación. Solo al confirmar desde ese modal se ejecuta la
  // mutación.

  const handleConfirmAprobar = (vars: { id: string; montoRecibido?: number }) => {
    setAprobarTarget(null);
    aprobarMutation.mutate(vars);
  };

  const handleConfirmRechazar = () => {
    if (!rechazarTarget) return;
    rechazarMutation.mutate(rechazarTarget.id);
    setRechazarTarget(null);
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    setActiveCard((e.active.data.current?.tx as TransaccionCobro | undefined) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const tx = e.active.data.current?.tx as TransaccionCobro | undefined;
    setActiveCard(null);
    const destino = e.over ? String(e.over.id) : null;
    if (!tx || !destino || !esDestinoValido(tx, destino)) return;

    // En vez de ejecutar directamente, abrimos el modal de confirmación.
    if (destino === 'Aprobado') {
      setAprobarTarget(tx);
    } else {
      setRechazarTarget(tx);
    }
  };

  return (
    <div className="flex h-[calc(100svh-6.5rem)] flex-col gap-6">
      {/* Page Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-foreground">
            Cobros
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {pendientes.length} cobro{pendientes.length === 1 ? '' : 's'} pendiente
            {pendientes.length === 1 ? '' : 's'} de aprobar · {formatPeso(totalPorConfirmar)} por
            confirmar
          </p>
        </div>
        <span className="inline-flex items-center gap-[7px] rounded-full bg-warning-subtle px-3 py-2 text-[13px] font-medium text-warning-foreground">
          <span className="size-2 animate-pulse rounded-full bg-warning" />
          En tiempo real
        </span>
      </div>

      {/* Toolbar: filtro por método + selector de día */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                filtro === f.value
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'font-medium text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          Hoy
          <span className="text-[11px] text-muted-foreground">▾</span>
        </button>
      </div>

      {/* Kanban Board */}
      {pendientes.length === 0 && aprobados.length === 0 && rechazados.length === 0 ? (
        <div className="flex flex-1 flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Receipt className="size-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No hay cobros</h3>
          <p className="mt-1 max-w-sm text-muted-foreground">
            Cuando una mesa pida pagar en efectivo o con tarjeta, el cobro aparecerá acá para que
            lo confirmes.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCard(null)}
        >
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
            {/* Columna Pendiente */}
            <BoardColumn
              id="Pendiente"
              color="bg-warning"
              title="Pendiente"
              count={pendientes.length}
              activeCard={activeCard}
            >
              {pendientes.map((tx) => (
                <DraggableCard key={tx.id} tx={tx}>
                  <CobroPendienteCard
                    tx={tx}
                    onAprobar={setAprobarTarget}
                    onRechazar={setRechazarTarget}
                  />
                </DraggableCard>
              ))}
            </BoardColumn>

            {/* Columna Aprobado */}
            <BoardColumn
              id="Aprobado"
              color="bg-success"
              title="Aprobado"
              count={aprobados.length}
              activeCard={activeCard}
            >
              {aprobados.map((tx) => (
                <CobroResueltoCard key={tx.id} tx={tx} />
              ))}
            </BoardColumn>

            {/* Columna Rechazado */}
            <BoardColumn
              id="Rechazado"
              color="bg-destructive"
              title="Rechazado"
              count={rechazados.length}
              activeCard={activeCard}
            >
              {rechazados.map((tx) => (
                <CobroResueltoCard key={tx.id} tx={tx} />
              ))}
            </BoardColumn>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className="w-[345px] rotate-2 cursor-grabbing shadow-xl">
                <CobroPendienteCard
                  tx={activeCard}
                  onAprobar={() => {}}
                  onRechazar={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de aprobación (doble confirmación: card / drag → dialog → confirmar) */}
      <AprobarCobroDialog
        tx={aprobarTarget}
        open={!!aprobarTarget}
        onOpenChange={(o) => !o && setAprobarTarget(null)}
        onConfirm={handleConfirmAprobar}
      />

      {/* Confirmación de rechazo (doble confirmación: card ✕ / drag → dialog → confirmar) */}
      <Dialog open={!!rechazarTarget} onOpenChange={(o) => !o && setRechazarTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Rechazar este cobro?</DialogTitle>
            <DialogDescription>
              {rechazarTarget
                ? `El cobro de la mesa ${rechazarTarget.mesaIdentificador} se marca como rechazado. `
                : ''}
              La mesa seguirá abierta para volver a cobrar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={rechazarMutation.isPending}
              onClick={handleConfirmRechazar}
            >
              {rechazarMutation.isPending ? 'Rechazando…' : 'Rechazar cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Draggable Card ────────────────────────────────────────────────────── */

function DraggableCard({ tx, children }: { tx: TransaccionCobro; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tx.id,
    data: { tx },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'touch-none cursor-grab rounded-xl outline-none ring-primary focus-visible:ring-2 active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      {children}
    </div>
  );
}

/* ─── Board Column (droppable) ──────────────────────────────────────────── */

function BoardColumn({
  id,
  color,
  title,
  count,
  activeCard,
  children,
}: {
  id: string;
  color: string;
  title: string;
  count: number;
  activeCard: TransaccionCobro | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  // Resaltar la columna destino cuando se arrastra una card válida sobre ella.
  const resaltar = isOver && activeCard != null && esDestinoValido(activeCard, id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full w-[365px] shrink-0 flex-col gap-3 rounded-xl bg-muted/60 p-3 transition-colors',
        resaltar && 'bg-primary/5 ring-2 ring-inset ring-primary/50',
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-[7px]">
          <span className={`size-[9px] rounded-full ${color}`} />
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
        </div>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
          {count}
        </span>
      </div>

      {/* Cards — solo scrollea esta zona */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {hasChildren ? (
          children
        ) : (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin cobros</p>
        )}
      </div>
    </div>
  );
}
