'use client';

import { useDraggable } from '@dnd-kit/core';
import { Users } from 'lucide-react';
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

  // Colores: en modo operación reflejan ocupación; en edición, neutro
  let estilo: string;
  if (editando) {
    estilo = seleccionada
      ? 'border-primary bg-accent ring-2 ring-ring'
      : 'border-border-strong bg-card';
  } else if (seleccionada) {
    estilo = ocupada
      ? 'border-warning bg-warning-subtle ring-2 ring-warning/50'
      : 'border-success bg-success-subtle ring-2 ring-success/50';
  } else if (ocupada) {
    estilo = 'border-warning bg-warning-subtle hover:bg-warning-subtle';
  } else {
    estilo = 'border-success bg-success-subtle hover:bg-success-subtle';
  }

  // Durante el arrastre, dnd-kit nos da un translate en px de pantalla; como el
  // lienzo ya no usa scale CSS, esos px coinciden 1:1 con el lienzo.
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
        className={`w-full h-full border-2 shadow-sm flex flex-col items-center justify-center overflow-hidden transition-colors ${estilo} ${
          esRedonda ? 'rounded-full' : 'rounded-lg'
        } ${puedeArrastrar ? 'cursor-move' : 'cursor-pointer'}`}
        title={mesa.identificador}
      >
        <span className="text-[11px] font-bold text-foreground leading-tight px-1 text-center truncate max-w-full">
          {mesa.identificador}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Users size={10} />
          {mesa.capacidad}
        </span>
        {!editando && (
          <span
            className={`mt-0.5 text-[8px] font-bold uppercase tracking-wide ${
              ocupada ? 'text-warning-foreground' : 'text-success-foreground'
            }`}
          >
            {ocupada ? 'Ocupada' : 'Libre'}
          </span>
        )}
      </div>

      {/* Tirador de redimensionar (solo seleccionada en edición) */}
      {editando && seleccionada && onResizePointerDown && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizePointerDown(e);
          }}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-primary border-2 border-white rounded-full cursor-nwse-resize shadow"
          title="Redimensionar"
        />
      )}
    </div>
  );
}
