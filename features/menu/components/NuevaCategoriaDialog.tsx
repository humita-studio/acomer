'use client';

import { useState } from 'react';
import { useCrearCategoria } from '@/features/menu/hooks/useCategorias';
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

export function NuevaCategoriaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [nombre, setNombre] = useState('');
  const crearCategoria = useCrearCategoria();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = nombre.trim();
    if (!value) return;
    crearCategoria.mutate(value);
    setNombre('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Agrupá tus platos para ordenar la carta.</DialogDescription>
          </DialogHeader>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!nombre.trim()}>
              Crear categoría
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
