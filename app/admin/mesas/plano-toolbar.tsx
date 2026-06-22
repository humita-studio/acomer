'use client';

import {
  Eye,
  List as ListIcon,
  Minus,
  MousePointer2,
  Pencil,
  PenLine,
  Plus,
  Save,
  Square,
  Trash2,
} from 'lucide-react';
import { type AmbienteUI, type Herramienta } from './plano-types';

/** Barra superior del editor: pestañas de ambiente + herramientas y acciones. */
export function PlanoToolbar({
  ambientes,
  activeId,
  ambienteActivo,
  editando,
  canManage,
  mostrarLista,
  herramienta,
  dirty,
  guardando,
  onCambiarAmbiente,
  onRenameAmbiente,
  onAddAmbiente,
  onToggleMostrarLista,
  onToggleModo,
  onSetHerramienta,
  onAddMesa,
  onDeleteAmbiente,
  onGuardar,
}: {
  ambientes: AmbienteUI[];
  activeId: string;
  ambienteActivo: AmbienteUI | null;
  editando: boolean;
  canManage: boolean;
  mostrarLista: boolean;
  herramienta: Herramienta;
  dirty: boolean;
  guardando: boolean;
  onCambiarAmbiente: (id: string) => void;
  onRenameAmbiente: (amb: AmbienteUI) => void;
  onAddAmbiente: () => void;
  onToggleMostrarLista: () => void;
  onToggleModo: () => void;
  onSetHerramienta: (h: Herramienta) => void;
  onAddMesa: () => void;
  onDeleteAmbiente: (amb: AmbienteUI) => void;
  onGuardar: () => void;
}) {
  return (
    <>
      {/* Barra superior: pestañas de ambiente + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {ambientes.map((amb) => {
            const activo = amb.id === activeId;
            return (
              <button
                key={amb.id}
                onClick={() => onCambiarAmbiente(amb.id)}
                onDoubleClick={() => editando && onRenameAmbiente(amb)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activo ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={editando ? 'Doble clic para renombrar' : undefined}
              >
                {amb.nombre}
              </button>
            );
          })}
          {editando && (
            <button
              onClick={onAddAmbiente}
              className="px-2.5 py-1.5 rounded-md text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 flex items-center gap-1"
            >
              <Plus size={14} /> Ambiente
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!editando && (
            <button
              onClick={onToggleMostrarLista}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition border ${
                mostrarLista
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ListIcon size={16} /> Lista
            </button>
          )}
          {canManage && (
            <button
              onClick={onToggleModo}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition ${
                editando ? 'bg-gray-700 text-white hover:bg-gray-800' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {editando ? (
                <>
                  <Eye size={16} /> Modo operación
                </>
              ) : (
                <>
                  <Pencil size={16} /> Editar plano
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Barra de herramientas (solo edición) */}
      {editando && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg">
          <ToolButton active={herramienta === 'seleccionar'} onClick={() => onSetHerramienta('seleccionar')}>
            <MousePointer2 size={14} /> Mover
          </ToolButton>
          <ToolButton active={herramienta === 'pared'} onClick={() => onSetHerramienta('pared')}>
            <Minus size={14} /> Pared
          </ToolButton>
          <ToolButton active={herramienta === 'linea'} onClick={() => onSetHerramienta('linea')}>
            <PenLine size={14} /> Línea
          </ToolButton>
          <ToolButton active={herramienta === 'barra'} onClick={() => onSetHerramienta('barra')}>
            <Square size={14} /> Barra
          </ToolButton>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={onAddMesa}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100"
          >
            <Plus size={14} /> Mesa
          </button>
          {ambienteActivo && ambientes.length > 1 && (
            <button
              onClick={() => onDeleteAmbiente(ambienteActivo)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
              title="Eliminar el ambiente actual"
            >
              <Trash2 size={14} /> Ambiente
            </button>
          )}
          <div className="flex-1" />
          {dirty && <span className="text-xs text-amber-600 font-medium">Cambios sin guardar</span>}
          <button
            onClick={onGuardar}
            disabled={!dirty || guardando}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            <Save size={15} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </>
  );
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
        active ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}
