import Link from 'next/link';
import { BrandMark } from '@/features/marketing/components/BrandMark';

/**
 * Shell visual compartido para login, registro, forgot y cambiar contraseña.
 * Mismo fondo y card que el wizard de registro.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <Link href="/" aria-label="acomer — inicio">
            <BrandMark />
          </Link>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
        {footer ? (
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </main>
  );
}
