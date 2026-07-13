'use client';

import { useDraggable } from '@dnd-kit/core';
import { RotateCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { type ElementoPlanoUI, type Modo } from './plano-types';

export function ElementoNode({
  elemento,
  modo,
  cell,
  seleccionado,
  puedeArrastrar,
  onResizePointerDown,
  onRotatePointerDown,
  onClick,
}: {
  elemento: ElementoPlanoUI;
  modo: Modo;
  cell: number;
  seleccionado: boolean;
  puedeArrastrar: boolean;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onRotatePointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const editando = modo === 'editar';
  const esParedFina = elemento.tipo === 'pared' && elemento.alto <= 0.5;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: elemento.id,
    disabled: !puedeArrastrar,
    data: {
      kind: 'elemento',
      posX: elemento.posX,
      posY: elemento.posY,
      ancho: elemento.ancho,
      alto: elemento.alto,
    },
  });

  // Estilo por tipo — paredes como trazo limpio, barra como bloque de madera
  let estilo: string;
  switch (elemento.tipo) {
    case 'barra':
      estilo =
        'bg-gradient-to-b from-[#9a7b55] to-[#7a5f40] border border-[#5c4630]/80 text-[#faf7f2] shadow-sm rounded-md';
      break;
    case 'contorno':
      estilo = 'bg-transparent border-2 border-dashed border-border-strong rounded-md';
      break;
    case 'decoracion':
      estilo = 'bg-success-subtle/80 border border-success/30 rounded-full';
      break;
    case 'pared':
    default:
      estilo = esParedFina
        ? 'bg-[#3d3a36] border-0 shadow-sm rounded-full'
        : 'bg-[#3d3a36]/90 border border-[#2a2825] shadow-sm rounded-md';
      break;
  }

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) ` : '';
  const showHandles = editando && seleccionado && puedeArrastrar;

  return (
    <div
      ref={setNodeRef}
      className="absolute select-none touch-none"
      style={{
        left: elemento.posX * cell,
        top: elemento.posY * cell,
        width: elemento.ancho * cell,
        height: elemento.alto * cell,
        transform: `${translate}rotate(${elemento.rotacion}deg)`,
        zIndex: isDragging ? 30 : seleccionado ? 4 : 0,
      }}
    >
      <div
        {...(puedeArrastrar ? { ...listeners, ...attributes } : {})}
        onClick={editando ? onClick : undefined}
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden',
          estilo,
          puedeArrastrar ? 'cursor-move' : 'cursor-default',
          seleccionado && 'ring-2 ring-primary/45 ring-offset-1 ring-offset-transparent',
        )}
      >
        {elemento.etiqueta && (
          <span className="max-w-full truncate px-1 text-[10px] font-semibold tracking-wide">
            {elemento.etiqueta}
          </span>
        )}
      </div>

      {showHandles && onRotatePointerDown && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 -translate-y-full bg-primary/50" />
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRotatePointerDown(e);
            }}
            className="absolute left-1/2 top-0 flex size-5 -translate-x-1/2 -translate-y-[130%] cursor-grab items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow active:cursor-grabbing"
            title="Arrastrá para rotar · Shift = 15°"
            aria-label="Rotar elemento"
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
