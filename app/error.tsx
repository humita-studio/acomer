'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { reportError } from '@/shared/lib/report-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { scope: 'app/error' });
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Algo salió mal
          </h1>
          <p className="text-sm text-muted-foreground">
            No es tu culpa. Probá de nuevo; si sigue fallando, avisá al local.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" className="w-full" onClick={reset}>
            Reintentar
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
