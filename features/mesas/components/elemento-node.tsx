'use client';

import { useDraggable } from '@dnd-kit/core';
import { type ElementoPlanoUI, type Modo } from './plano-types';

export function ElementoNode({
  elemento,
  modo,
  cell,
  seleccionado,
  puedeArrastrar,
  onResizePointerDown,
  onClick,
}: {
  elemento: ElementoPlanoUI;
  modo: Modo;
  cell: number;
  seleccionado: boolean;
  puedeArrastrar: boolean;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const editando = modo === 'editar';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: elemento.id,
    disabled: !puedeArrastrar,
    data: { kind: 'elemento', posX: elemento.posX, posY: elemento.posY, ancho: elemento.ancho, alto: elemento.alto },
  });

  // Estilo por tipo de elemento (paleta Figma acomer)
  let estilo: string;
  switch (elemento.tipo) {
    case 'barra':
      estilo = 'bg-[#8b6b4a]/80 border border-[#6b5238] text-[#faf7f2]';
      break;
    case 'contorno':
      estilo = 'bg-transparent border-2 border-border-strong';
      break;
    case 'decoracion':
      estilo = 'bg-success-subtle border border-success/40';
      break;
    case 'pared':
    default:
      estilo = 'bg-secondary-foreground/55 border border-secondary-foreground/70';
      break;
  }

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) ` : '';

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
        zIndex: isDragging ? 30 : 0,
      }}
    >
      <div
        {...(puedeArrastrar ? { ...listeners, ...attributes } : {})}
        onClick={editando ? onClick : undefined}
        className={`w-full h-full flex items-center justify-center overflow-hidden rounded-sm ${estilo} ${
          puedeArrastrar ? 'cursor-move' : 'cursor-default'
        } ${seleccionado ? 'ring-2 ring-primary/40' : ''}`}
      >
        {elemento.etiqueta && (
          <span className="text-[10px] font-semibold px-1 truncate max-w-full">
            {elemento.etiqueta}
          </span>
        )}
      </div>

      {editando && seleccionado && onResizePointerDown && (
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
