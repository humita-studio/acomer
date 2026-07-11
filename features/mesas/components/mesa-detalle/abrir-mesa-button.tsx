'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { abrirMesaAction } from '@/features/mesas/mesas-actions';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

/**
 * Botón para que el mozo abra (ocupe) la mesa sin que el cliente escanee el QR,
 * por ejemplo cuando alguien se niega a pedir desde su teléfono.
 */
export function AbrirMesaButton({ mesaId }: { mesaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAbrir = async () => {
    setLoading(true);
    setError(null);
    const res = await abrirMesaAction(mesaId);
    setLoading(false);
    if (res.success) {
      router.refresh();
    } else {
      setError(res.message || 'No se pudo abrir la mesa');
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="max-w-md text-sm text-text-secondary">
          Esta mesa no tiene una sesión activa. Podés abrirla vos para tomar el pedido, o se abre
          sola cuando un comensal escanea el QR.
        </p>
        <Button type="button" size="lg" onClick={handleAbrir} disabled={loading}>
          <ClipboardList />
          {loading ? 'Abriendo…' : 'Abrir mesa y tomar pedido'}
        </Button>
        {error && (
          <div className="w-full max-w-md rounded-lg bg-destructive-subtle px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
