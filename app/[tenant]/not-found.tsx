import Link from 'next/link';
import { Button } from '@/shared/ui/button';

export default function TenantNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="font-display text-5xl font-semibold text-muted-foreground/40">404</p>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Local no encontrado
          </h1>
          <p className="text-sm text-muted-foreground">
            Ese subdominio no existe o el link de la mesa es inválido. Pedile al mozo el QR
            correcto.
          </p>
        </div>
        <Button asChild className="w-full" variant="outline">
          <Link href="/">Ir a acomer</Link>
        </Button>
      </div>
    </main>
  );
}
