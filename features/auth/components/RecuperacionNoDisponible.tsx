import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { SOPORTE_EMAIL } from '@/shared/lib/contacto';

/**
 * Reemplaza al formulario de "olvidé mi contraseña" mientras no haya SMTP
 * configurado (`NEXT_PUBLIC_AUTH_EMAIL_HABILITADO` apagado): antes el form
 * decía "Revisá tu email" y el email nunca llegaba.
 */
export function RecuperacionNoDisponible() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center sm:text-left">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mx-0">
          <KeyRound className="size-6" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Recuperar la contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Por ahora no mandamos emails de recuperación. Así se resuelve:
        </p>
      </div>

      <ul className="space-y-3 text-sm">
        <li className="rounded-lg border bg-card p-3">
          <p className="font-medium">Si trabajás en el local</p>
          <p className="text-muted-foreground">
            Pedile al dueño una clave nueva: la genera en Empleados → “Nueva clave” y
            te la pasa. Al entrar elegís la tuya.
          </p>
        </li>
        <li className="rounded-lg border bg-card p-3">
          <p className="font-medium">Si sos el dueño</p>
          <p className="text-muted-foreground">
            Escribinos a{' '}
            <a href={`mailto:${SOPORTE_EMAIL}`} className="font-medium text-primary hover:underline">
              {SOPORTE_EMAIL}
            </a>{' '}
            desde el email de tu cuenta y te la reseteamos.
          </p>
        </li>
      </ul>

      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Volver a ingresar</Link>
      </Button>
    </div>
  );
}
