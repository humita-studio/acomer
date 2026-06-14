'use client';

import { Users } from 'lucide-react';
import { GRID_PX, type MesaPlano, type Modo } from './plano-types';

export function MesaNode({
  mesa,
  modo,
  seleccionada,
  ocupada,
  onBodyPointerDown,
  onResizePointerDown,
  onClick,
}: {
  mesa: MesaPlano;
  modo: Modo;
  seleccionada: boolean;
  ocupada: boolean;
  onBodyPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const editando = modo === 'editar';
  const esRedonda = mesa.forma === 'redonda';

  // Colores: en modo operación reflejan ocupación; en edición, neutro
  let estilo: string;
  if (editando) {
    estilo = seleccionada
      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
      : 'border-gray-400 bg-white';
  } else if (ocupada) {
    estilo = 'border-orange-400 bg-orange-50 hover:bg-orange-100';
  } else {
    estilo = 'border-green-400 bg-green-50 hover:bg-green-100';
  }

  return (
    <div
      className="absolute select-none touch-none"
      style={{
        left: mesa.posX * GRID_PX,
        top: mesa.posY * GRID_PX,
        width: mesa.ancho * GRID_PX,
        height: mesa.alto * GRID_PX,
        transform: `rotate(${mesa.rotacion}deg)`,
      }}
    >
      <div
        onPointerDown={editando ? onBodyPointerDown : undefined}
        onClick={!editando ? onClick : undefined}
        className={`w-full h-full border-2 shadow-sm flex flex-col items-center justify-center overflow-hidden transition-colors ${estilo} ${
          esRedonda ? 'rounded-full' : 'rounded-lg'
        } ${editando ? 'cursor-move' : 'cursor-pointer'}`}
        title={mesa.identificador}
      >
        <span className="text-[11px] font-bold text-gray-800 leading-tight px-1 text-center truncate max-w-full">
          {mesa.identificador}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
          <Users size={10} />
          {mesa.capacidad}
        </span>
        {!editando && (
          <span
            className={`mt-0.5 text-[8px] font-bold uppercase tracking-wide ${
              ocupada ? 'text-orange-600' : 'text-green-600'
            }`}
          >
            {ocupada ? 'Ocupada' : 'Libre'}
          </span>
        )}
      </div>

      {/* Tirador de redimensionar (solo seleccionada en edición) */}
      {editando && seleccionada && onResizePointerDown && (
        <div
          onPointerDown={onResizePointerDown}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow"
          title="Redimensionar"
        />
      )}
    </div>
  );
}
