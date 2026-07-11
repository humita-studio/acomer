'use client';

import {
  Check,
  CloudOff,
  List as ListIcon,
  Loader2,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { SaveStatus } from './plano-store';
import { type AmbienteUI, type Herramienta, type Modo } from './plano-types';

/** Barra del canvas: modos Operar/Editar, legend, herramientas y ambientes. */
export function PlanoToolbar({
  ambientes,
  activeId,
  ambienteActivo,
  modo,
  canManage,
  mostrarLista,
  herramienta,
  saveStatus,
  stats,
  onCambiarAmbiente,
  onRenameAmbiente,
  onAddAmbiente,
  onToggleMostrarLista,
  onSetModo,
  onSetHerramienta,
  onAddMesa,
  onDeleteAmbiente,
  onRetrySave,
}: {
  ambientes: AmbienteUI[];
  activeId: string;
  ambienteActivo: AmbienteUI | null;
  modo: Modo;
  canManage: boolean;
  mostrarLista: boolean;
  herramienta: Herramienta;
  saveStatus: SaveStatus;
  stats: { ocupadas: number; libres: number; total: number };
  onCambiarAmbiente: (id: string) => void;
  onRenameAmbiente: (amb: AmbienteUI) => void;
  onAddAmbiente: () => void;
  onToggleMostrarLista: () => void;
  onSetModo: (modo: Modo) => void;
  onSetHerramienta: (h: Herramienta) => void;
  onAddMesa: () => void;
  onDeleteAmbiente: (amb: AmbienteUI) => void;
  onRetrySave?: () => void;
}) {
  const editando = modo === 'editar';

  return (
    <div className="space-y-3">
      {/* Toggle Operar / Editar + legend + lista */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        {canManage ? (
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => onSetModo('ver')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                !editando
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Operar
            </button>
            <button
              type="button"
              onClick={() => onSetModo('editar')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                editando
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Editar
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-foreground">Operar</span>
        )}

        <div className="hidden h-4 w-px bg-border sm:block" />

        {!editando && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            <LegendDot className="bg-primary" label="Ocupada" count={stats.ocupadas} />
            <LegendDot className="bg-success" label="Libre" count={stats.libres} />
            <span className="text-muted-foreground">{stats.total} mesas</span>
          </div>
        )}

        {editando && (
          <p className="text-xs text-muted-foreground">
            Los cambios se guardan solos · arrastrá y redimensioná libremente
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          {editando && <SaveIndicator status={saveStatus} onRetry={onRetrySave} />}
          {!editando && (
            <Button
              type="button"
              variant={mostrarLista ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onToggleMostrarLista}
            >
              <ListIcon />
              Lista
            </Button>
          )}
        </div>
      </div>

      {/* Ambientes */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 sm:px-4">
        {ambientes.map((amb) => {
          const activo = amb.id === activeId;
          return (
            <button
              key={amb.id}
              type="button"
              onClick={() => onCambiarAmbiente(amb.id)}
              onDoubleClick={() => editando && onRenameAmbiente(amb)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                activo
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-secondary-foreground hover:bg-muted/80',
              )}
              title={editando ? 'Doble clic para renombrar' : undefined}
            >
              {amb.nombre}
            </button>
          );
        })}
        {editando && (
          <Button type="button" variant="outline" size="sm" onClick={onAddAmbiente}>
            <Plus />
            Ambiente
          </Button>
        )}
      </div>

      {/* Herramientas de edición */}
      {editando && (
        <div className="mx-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-2 sm:mx-4">
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
          <div className="mx-1 h-6 w-px bg-border" />
          <Button type="button" variant="outline" size="sm" onClick={onAddMesa}>
            <Plus />
            Mesa
          </Button>
          {ambienteActivo && ambientes.length > 1 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDeleteAmbiente(ambienteActivo)}
              title="Eliminar el ambiente actual"
            >
              <Trash2 />
              Ambiente
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry?: () => void;
}) {
  if (status === 'idle') return null;

  if (status === 'saving' || status === 'dirty') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {status === 'saving' ? 'Guardando…' : 'Guardando…'}
      </span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline"
      >
        <CloudOff className="size-3.5" />
        Error al guardar · reintentar
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-foreground">
      <Check className="size-3.5" />
      Guardado
    </span>
  );
}

function LegendDot({ className, label, count }: { className: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', className)} />
      <span>
        {label}
        <span className="ml-1 tabular-nums text-muted-foreground">({count})</span>
      </span>
    </span>
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
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-secondary-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
