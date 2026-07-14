import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { Button } from '@/shared/ui/button';

export default function UnauthorizedPage() {
  return (
    <AuthShell>
      <div className="space-y-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Sin permiso
          </h1>
          <p className="text-sm text-muted-foreground">
            No tenés acceso a esta sección del panel. Pedile al dueño del local que
            revise tu rol.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/admin">Volver al panel</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
