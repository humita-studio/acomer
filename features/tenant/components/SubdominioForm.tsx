'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { actualizarSubdominioAction } from '../tenantActions';
import { normalizarSubdominio, validarSubdominio, SUBDOMINIO_MIN } from '../subdominio';

/** Editor del subdominio público del local (= restaurantes.slug). */
export function SubdominioForm({
  slugActual,
  dominioBase,
}: {
  slugActual: string;
  dominioBase: string;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(slugActual);

  const normalizado = normalizarSubdominio(valor);
  const error = normalizado.length > 0 ? validarSubdominio(normalizado) : null;
  const sinCambios = normalizado === slugActual;
  const puedeGuardar = !error && normalizado.length >= SUBDOMINIO_MIN && !sinCambios;

  const guardar = useMutation({
    mutationFn: async () => {
      const res = await actualizarSubdominioAction(valor);
      if (!res.success) throw new Error(res.message ?? 'No se pudo guardar');
      return res;
    },
    onSuccess: (res) => {
      if (res.slug) setValor(res.slug);
      toast.success('Subdominio actualizado');
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dirección web</CardTitle>
        <CardDescription>El subdominio donde tus clientes encuentran tu local.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="subdominio">Subdominio</Label>
          <div className="flex items-center gap-2">
            <Input
              id="subdominio"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="mi-local"
              className="max-w-[16rem]"
              aria-invalid={!!error}
            />
            <span className="text-sm text-muted-foreground">.{dominioBase}</span>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu local quedará en{' '}
              <span className="font-medium text-foreground">
                {normalizado || 'tu-local'}.{dominioBase}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Cambiar el subdominio cambia la URL pública de tu local. Los códigos QR de las mesas que
            ya hayas impreso dejarán de funcionar y habrá que reimprimirlos.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => guardar.mutate()} disabled={!puedeGuardar || guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar subdominio'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
