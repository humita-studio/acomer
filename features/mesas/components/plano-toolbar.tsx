'use client';

import {
  Check,
  CloudOff,
  List as ListIcon,
  Loader2,
  Magnet,
  Minus,
  MousePointer2,
  Plus,
  Square,
  Table2,
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
  snapEnabled,
  saveStatus,
  stats,
  onCambiarAmbiente,
  onRenameAmbiente,
  onAddAmbiente,
  onToggleMostrarLista,
  onSetModo,
  onSetHerramienta,
  onToggleSnap,
  onAddMesaRapida,
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
  snapEnabled: boolean;
  saveStatus: SaveStatus;
  stats: { ocupadas: number; libres: number; total: number };
  onCambiarAmbiente: (id: string) => void;
  onRenameAmbiente: (amb: AmbienteUI) => void;
  onAddAmbiente: () => void;
  onToggleMostrarLista: () => void;
  onSetModo: (modo: Modo) => void;
  onSetHerramienta: (h: Herramienta) => void;
  onToggleSnap: () => void;
  /** Coloca una mesa en el primer hueco libre (sin click en el plano). */
  onAddMesaRapida: () => void;
  onDeleteAmbiente: (amb: AmbienteUI) => void;
  onRetrySave?: () => void;
}) {
  const editando = modo === 'editar';

  return (
    <div className="space-y-3">
      {/* Toggle Operar / Editar + legend + lista */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        {canManage ? (
          <div role="tablist" aria-label="Modo del plano" className="flex items-center rounded-lg bg-muted p-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={!editando}
              onClick={() => onSetModo('ver')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                !editando
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Operar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editando}
              onClick={() => onSetModo('editar')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
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
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Resumen de mesas">
            <StatPill className="bg-accent text-primary" label="Ocupada" count={stats.ocupadas} />
            <StatPill
              className="bg-success-subtle text-success-foreground"
              label="Libre"
              count={stats.libres}
            />
            <span className="text-xs text-muted-foreground">{stats.total} mesas</span>
          </div>
        )}

        {editando && (
          <p className="text-xs text-muted-foreground">
            Autosave · V mover · M mesa · P pared · R rotar · Del borrar
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
      <div className="px-3 sm:px-4">
        <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Ambientes
        </span>
        <div
          role="tablist"
          aria-label="Ambientes del salón"
          className="flex flex-wrap items-center gap-1.5"
        >
          {ambientes.map((amb) => {
            const activo = amb.id === activeId;
            return (
              <button
                key={amb.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => onCambiarAmbiente(amb.id)}
                onDoubleClick={() => editando && onRenameAmbiente(amb)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
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
      </div>

      {/* Herramientas de edición */}
      {editando && (
        <div className="mx-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-2 sm:mx-4">
          <ToolButton
            active={herramienta === 'seleccionar'}
            onClick={() => onSetHerramienta('seleccionar')}
            title="Mover y seleccionar (V)"
          >
            <MousePointer2 size={14} /> Mover
          </ToolButton>
          <ToolButton
            active={herramienta === 'mesa'}
            onClick={() => onSetHerramienta('mesa')}
            title="Click en el plano para colocar mesas (M)"
          >
            <Table2 size={14} /> Mesa
          </ToolButton>
          <ToolButton
            active={herramienta === 'pared' || herramienta === 'linea'}
            onClick={() => onSetHerramienta('pared')}
            title="Trazar pared de punta a punta (P) · Shift = ángulo libre"
          >
            <Minus size={14} /> Pared
          </ToolButton>
          <ToolButton
            active={herramienta === 'barra'}
            onClick={() => onSetHerramienta('barra')}
            title="Dibujar barra / mostrador (B)"
          >
            <Square size={14} /> Barra
          </ToolButton>

          <div className="mx-1 h-6 w-px bg-border" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddMesaRapida}
            title="Agrega una mesa en el primer hueco libre"
          >
            <Plus />
            Auto
          </Button>

          <ToolButton
            active={snapEnabled}
            onClick={onToggleSnap}
            title={snapEnabled ? 'Snap a grilla activado' : 'Snap a grilla desactivado'}
          >
            <Magnet size={14} /> Snap
          </ToolButton>

          {ambienteActivo && ambientes.length > 1 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDeleteAmbiente(ambienteActivo)}
              title="Eliminar el ambiente actual"
              className="ml-auto"
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
        Guardando…
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

function StatPill({ className, label, count }: { className: string; label: string; count: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
      <span className="tabular-nums">{count}</span>
    </span>
  );
}

function ToolButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-secondary-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
