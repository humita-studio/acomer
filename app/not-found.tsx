import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { Button } from '@/shared/ui/button';

export default function NotFound() {
  return (
    <AuthShell>
      <div className="space-y-6 text-center">
        <p className="font-display text-5xl font-semibold text-muted-foreground/40">404</p>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Página no encontrada
          </h1>
          <p className="text-sm text-muted-foreground">
            El link no existe o el local no está disponible. Revisá la URL o volvé al inicio.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
