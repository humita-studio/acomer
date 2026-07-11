'use client';

import { useDraggable } from '@dnd-kit/core';
import { Users } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { type MesaPlano, type Modo } from './plano-types';

export function MesaNode({
  mesa,
  modo,
  cell,
  seleccionada,
  ocupada,
  puedeArrastrar,
  onResizePointerDown,
  onClick,
}: {
  mesa: MesaPlano;
  modo: Modo;
  cell: number;
  seleccionada: boolean;
  ocupada: boolean;
  puedeArrastrar: boolean;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const editando = modo === 'editar';
  const esRedonda = mesa.forma === 'redonda';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: mesa.id,
    disabled: !puedeArrastrar,
    data: { kind: 'mesa', posX: mesa.posX, posY: mesa.posY, ancho: mesa.ancho, alto: mesa.alto },
  });

  // Colores del Figma: ocupada = terracota, libre = verde, edición = neutro.
  const estilo = editando
    ? seleccionada
      ? 'border-primary bg-accent ring-2 ring-primary/30 text-foreground'
      : 'border-border-strong bg-card text-foreground hover:border-primary/40'
    : ocupada
      ? seleccionada
        ? 'border-primary bg-accent ring-2 ring-primary/35 text-primary'
        : 'border-primary/50 bg-accent text-primary hover:bg-accent/80'
      : seleccionada
        ? 'border-success bg-success-subtle ring-2 ring-success/30 text-success-foreground'
        : 'border-success/45 bg-success-subtle text-success-foreground hover:bg-success-subtle/80';

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) ` : '';

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
          'flex h-full w-full flex-col items-center justify-center overflow-hidden border-2 shadow-sm transition-colors',
          esRedonda ? 'rounded-full' : 'rounded-xl',
          puedeArrastrar ? 'cursor-move' : 'cursor-pointer',
          estilo,
        )}
        title={`${mesa.identificador} · ${ocupada ? 'Ocupada' : 'Libre'}`}
      >
        <span className="max-w-full truncate px-1 text-center text-sm font-semibold leading-tight">
          {mesa.identificador}
        </span>
        <span className="mt-0.5 flex items-center gap-0.5 text-[11px] opacity-80">
          <Users size={11} />
          {mesa.capacidad}
        </span>
      </div>

      {editando && seleccionada && onResizePointerDown && (
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
