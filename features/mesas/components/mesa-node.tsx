'use client';

import { useDraggable } from '@dnd-kit/core';
import { RotateCw, Users } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { type MesaPlano, type Modo } from './plano-types';

export function MesaNode({
  mesa,
  modo,
  cell,
  seleccionada,
  ocupada,
  puedeArrastrar,
  mozoNombre,
  onResizePointerDown,
  onRotatePointerDown,
  onClick,
}: {
  mesa: MesaPlano;
  modo: Modo;
  cell: number;
  seleccionada: boolean;
  ocupada: boolean;
  puedeArrastrar: boolean;
  /** Nombre corto del mozo asignado (null si no hay). */
  mozoNombre?: string | null;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onRotatePointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const editando = modo === 'editar';
  const esRedonda = mesa.forma === 'redonda';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: mesa.id,
    disabled: !puedeArrastrar,
    data: { kind: 'mesa', posX: mesa.posX, posY: mesa.posY, ancho: mesa.ancho, alto: mesa.alto },
  });

  // Colores: edición neutra madera; operación ocupada/libre.
  const estilo = editando
    ? seleccionada
      ? 'border-primary bg-[#d4b896] ring-2 ring-primary/35 text-foreground shadow-md'
      : 'border-[#a68b6a]/70 bg-[#e8d4b8] text-foreground shadow-sm hover:border-primary/50'
    : ocupada
      ? seleccionada
        ? 'border-primary bg-accent ring-2 ring-primary/35 text-primary'
        : 'border-primary/50 bg-accent text-primary hover:bg-accent/80'
      : seleccionada
        ? 'border-success bg-success-subtle ring-2 ring-success/30 text-success-foreground'
        : 'border-success/45 bg-success-subtle text-success-foreground hover:bg-success-subtle/80';

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) ` : '';
  const showHandles = editando && seleccionada && puedeArrastrar;

  return (
    <div
      ref={setNodeRef}
      className="absolute select-none touch-none"
      style={{
        left: mesa.posX * cell,
        top: mesa.posY * cell,
        width: mesa.ancho * cell,
        height: mesa.alto * cell,
        transform: `${translate}rotate(${mesa.rotacion}deg)`,
        zIndex: isDragging ? 30 : seleccionada ? 5 : 1,
      }}
    >
      <div
        {...(puedeArrastrar ? { ...listeners, ...attributes } : {})}
        onClick={onClick}
        className={cn(
          'flex h-full w-full flex-col items-center justify-center overflow-hidden border-2 transition-colors',
          esRedonda ? 'rounded-full' : 'rounded-[28%]',
          puedeArrastrar ? 'cursor-move' : 'cursor-pointer',
          estilo,
        )}
        title={[
          mesa.identificador,
          ocupada ? 'Ocupada' : 'Libre',
          mesa.rotacion ? `${Math.round(mesa.rotacion)}°` : null,
          mozoNombre ? `Mozo: ${mozoNombre}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <span className="max-w-full truncate px-1 text-center text-sm font-semibold leading-tight">
          {mesa.identificador}
        </span>
        <span className="mt-0.5 flex items-center gap-0.5 text-[11px] opacity-80">
          <Users size={11} />
          {mesa.capacidad}
        </span>
        {mozoNombre && cell >= 18 && (
          <span className="mt-0.5 max-w-full truncate px-1 text-[10px] font-medium uppercase opacity-70">
            {mozoNombre.slice(0, 8)}
          </span>
        )}
      </div>

      {showHandles && onRotatePointerDown && (
        <>
          {/* Eje hacia el handle de rotación */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 -translate-y-full bg-primary/50" />
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRotatePointerDown(e);
            }}
            className="absolute left-1/2 top-0 flex size-5 -translate-x-1/2 -translate-y-[140%] cursor-grab items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow active:cursor-grabbing"
            title="Arrastrá para rotar · Shift = 15°"
            aria-label="Rotar mesa"
          >
            <RotateCw size={11} strokeWidth={2.5} />
          </button>
        </>
      )}

      {showHandles && onResizePointerDown && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizePointerDown(e);
          }}
          className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-full border-2 border-card bg-primary shadow"
          title="Redimensionar"
        />
      )}
    </div>
  );
}
