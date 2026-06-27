'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { actualizarNombreRestauranteAction } from '../tenantActions';

export function NombreLocalForm({ nombreActual }: { nombreActual: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreActual);

  const sinCambios = nombre.trim() === nombreActual;
  const puedeGuardar = nombre.trim().length > 0 && !sinCambios;

  const guardar = useMutation({
    mutationFn: async () => {
      const res = await actualizarNombreRestauranteAction(nombre);
      if (!res.success) throw new Error(res.message ?? 'No se pudo guardar');
      return res;
    },
    onSuccess: () => {
      toast.success('Nombre actualizado');
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nombre del Local</CardTitle>
        <CardDescription>El nombre principal de tu restaurante.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Mi Restaurante"
            className="max-w-[24rem]"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => guardar.mutate()} disabled={!puedeGuardar || guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar nombre'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
