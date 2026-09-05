import { AuthShell } from '@/features/auth/components/AuthShell';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';
import { RecuperacionNoDisponible } from '@/features/auth/components/RecuperacionNoDisponible';
import { AUTH_EMAIL_HABILITADO } from '@/features/auth/authEmail';

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      {AUTH_EMAIL_HABILITADO ? <ForgotPasswordForm /> : <RecuperacionNoDisponible />}
    </AuthShell>
  );
}
