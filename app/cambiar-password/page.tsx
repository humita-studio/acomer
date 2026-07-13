import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/shared/supabase/server';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { CambiarPasswordForm } from '@/features/auth/components/CambiarPasswordForm';
import { userMustChangePassword } from '@/features/auth/auth-errors';

export default async function CambiarPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const forzado = userMustChangePassword(user);

  return (
    <AuthShell>
      <CambiarPasswordForm forzado={forzado} />
    </AuthShell>
  );
}
