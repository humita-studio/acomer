import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentSession } from '@/features/auth/session';
import { RegistroWizard } from '@/features/auth/components/RegistroWizard';

export default async function RegisterPage() {
  // Si ya hay sesión válida, no tiene sentido registrarse de nuevo.
  const session = await getCurrentSession();
  if (session) redirect('/admin');

  // Dominio base para mostrar/armar el subdominio del local (ej. "acomer.com.ar"
  // o "localhost:3000" en dev). El registro vive en el dominio principal.
  const host = (await headers()).get('host') || '';
  const dominioBase = host.replace(/^app\./, '') || 'acomer.com.ar';

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <RegistroWizard dominioBase={dominioBase} />
    </main>
  );
}
