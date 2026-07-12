'use client';

import { useState } from 'react';
import { useCrearCategoria, useEditarCategoria } from '@/features/menu/hooks/useCategorias';
import type { CategoriaMenu } from '@/features/menu/types';
import {
  COLORES_CATEGORIA,
  COLORES_CATEGORIA_META,
  COLOR_CATEGORIA_DEFAULT,
  ICONOS_CATEGORIA,
  ICONOS_CATEGORIA_MAP,
  ICONO_CATEGORIA_DEFAULT,
  colorCategoriaMeta,
  isColorCategoria,
  isIconoCategoria,
  type ColorCategoria,
  type IconoCategoria,
} from '@/features/menu/categoriaVisual';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/lib/utils';

export function NuevaCategoriaDialog({
  open,
  onOpenChange,
  categoria,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el diálogo edita esa categoría; si no, crea una nueva. */
  categoria?: CategoriaMenu | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* key remonta el form al abrir crear vs editar (o cambiar de categoría). */}
        {open ? (
          <CategoriaForm
            key={categoria?.id ?? 'nueva'}
            categoria={categoria}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoriaForm({
  categoria,
  onClose,
}: {
  categoria?: CategoriaMenu | null;
  onClose: () => void;
}) {
  const editando = !!categoria;
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [color, setColor] = useState<ColorCategoria>(
    categoria?.color && isColorCategoria(categoria.color)
      ? categoria.color
      : COLOR_CATEGORIA_DEFAULT
  );
  const [icono, setIcono] = useState<IconoCategoria>(
    categoria?.icono && isIconoCategoria(categoria.icono)
      ? categoria.icono
      : ICONO_CATEGORIA_DEFAULT
  );

  const crearCategoria = useCrearCategoria();
  const editarCategoria = useEditarCategoria();
  const pending = crearCategoria.isPending || editarCategoria.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = nombre.trim();
    if (!value || pending) return;

    if (editando && categoria) {
      editarCategoria.mutate({ id: categoria.id, nombre: value, color, icono });
    } else {
      crearCategoria.mutate({ nombre: value, color, icono });
    }
    onClose();
  };

  const previewMeta = colorCategoriaMeta(color);
  const PreviewIcon = ICONOS_CATEGORIA_MAP[icono];

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>{editando ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        <DialogDescription>
          {editando
            ? 'Cambiá el nombre, el color o el icono de la categoría.'
            : 'Agrupá tus platos y elegí un color e icono para distinguirlos.'}
        </DialogDescription>
      </DialogHeader>

      {/* Preview */}
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: previewMeta.hex }}
          aria-hidden
        >
          <PreviewIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{nombre.trim() || 'Nombre de la categoría'}</p>
          <p className="text-xs text-muted-foreground">Vista previa</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="categoria-nombre" className="text-xs tracking-wide text-muted-foreground uppercase">
          Nombre
        </Label>
        <Input
          id="categoria-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Bebidas"
          autoFocus
          required
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-xs tracking-wide text-muted-foreground uppercase">Color</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de la categoría">
          {COLORES_CATEGORIA.map((c) => {
            const meta = COLORES_CATEGORIA_META[c];
            const selected = color === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={meta.label}
                title={meta.label}
                onClick={() => setColor(c)}
                className={cn(
                  'size-8 rounded-full transition-transform ring-offset-2 ring-offset-background',
                  selected ? 'scale-110 ring-2 ring-foreground' : 'hover:scale-105'
                )}
                style={{ backgroundColor: meta.hex }}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs tracking-wide text-muted-foreground uppercase">Icono</Label>
        <div
          className="grid max-h-40 grid-cols-6 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-7"
          role="radiogroup"
          aria-label="Icono de la categoría"
        >
          {ICONOS_CATEGORIA.map((key) => {
            const Icon = ICONOS_CATEGORIA_MAP[key];
            const selected = icono === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={key}
                title={key}
                onClick={() => setIcono(key)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg transition-colors',
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!nombre.trim() || pending}>
          {editando ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </DialogFooter>
    </form>
  );
}
