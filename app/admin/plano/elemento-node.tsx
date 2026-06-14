'use client';

import { GRID_PX, type ElementoPlanoUI, type Modo } from './plano-types';

export function ElementoNode({
  elemento,
  modo,
  seleccionado,
  onBodyPointerDown,
  onResizePointerDown,
  onClick,
}: {
  elemento: ElementoPlanoUI;
  modo: Modo;
  seleccionado: boolean;
  onBodyPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const editando = modo === 'editar';

  // Estilo por tipo de elemento
  let estilo: string;
  switch (elemento.tipo) {
    case 'barra':
      estilo = 'bg-amber-700/80 border border-amber-900 text-amber-50';
      break;
    case 'contorno':
      estilo = 'bg-transparent border-2 border-gray-400';
      break;
    case 'decoracion':
      estilo = 'bg-emerald-200/60 border border-emerald-500';
      break;
    case 'pared':
    default:
      estilo = 'bg-gray-500 border border-gray-700';
      break;
  }

  return (
    <div
      className="absolute select-none touch-none"
      style={{
        left: elemento.posX * GRID_PX,
        top: elemento.posY * GRID_PX,
        width: elemento.ancho * GRID_PX,
        height: elemento.alto * GRID_PX,
        transform: `rotate(${elemento.rotacion}deg)`,
        zIndex: 0,
      }}
    >
      <div
        onPointerDown={editando ? onBodyPointerDown : undefined}
        onClick={editando ? onClick : undefined}
        className={`w-full h-full flex items-center justify-center overflow-hidden rounded-sm ${estilo} ${
          editando ? 'cursor-move' : 'cursor-default'
        } ${seleccionado ? 'ring-2 ring-blue-400' : ''}`}
      >
        {elemento.etiqueta && (
          <span className="text-[10px] font-semibold px-1 truncate max-w-full">
            {elemento.etiqueta}
          </span>
        )}
      </div>

      {editando && seleccionado && onResizePointerDown && (
        <div
          onPointerDown={onResizePointerDown}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow"
          title="Redimensionar"
        />
      )}
    </div>
  );
}
