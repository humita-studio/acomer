'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { reportError } from '@/shared/lib/report-error';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { scope: 'admin/error' });
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <div className="max-w-sm space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Error en el panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Algo falló al cargar esta sección. Reintentá; si persiste, recargá la página.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
