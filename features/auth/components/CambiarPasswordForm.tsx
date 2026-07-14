'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TriangleAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { META_MUST_CHANGE_PASSWORD, traducirErrorAuth } from '../auth-errors';

const PASSWORD_MIN = 8;

/**
 * Formulario para definir/cambiar contraseña.
 * - Primer ingreso del staff (must_change_password en metadata).
 * - Link de recuperación de email.
 */
export function CambiarPasswordForm({ forzado = false }: { forzado?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ok =
    password.length >= PASSWORD_MIN && password === password2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) {
      if (password.length < PASSWORD_MIN) {
        setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
      } else if (password !== password2) {
        setError('Las contraseñas no coinciden.');
      }
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { [META_MUST_CHANGE_PASSWORD]: false },
      });

      if (updateError) {
        setError(traducirErrorAuth(updateError));
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(traducirErrorAuth(err, 'No se pudo guardar la contraseña.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {forzado ? 'Elegí tu contraseña' : 'Nueva contraseña'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {forzado
            ? 'Es tu primer ingreso. Por seguridad, cambiá la contraseña temporal que te dieron.'
            : 'Elegí una contraseña nueva para tu cuenta.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-pass">Nueva contraseña</Label>
          <Input
            id="new-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-pass2">Repetir contraseña</Label>
          <Input
            id="new-pass2"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            aria-invalid={password2.length > 0 && password2 !== password}
          />
          {password2.length > 0 && password2 !== password ? (
            <p className="text-sm text-destructive">Las contraseñas no coinciden.</p>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading || !ok} size="lg">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            'Guardar e ir al panel'
          )}
        </Button>
      </form>
    </div>
  );
}
