'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, TriangleAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { registrarLocalAction, type CampoRegistro } from '../registro-actions';
import { normalizarSubdominio, validarSubdominio, SUBDOMINIO_MIN } from '@/features/tenant/subdominio';
import { COLORES_MARCA, GRADIENTE_MARCA, type ColorMarca } from '@/features/landing/landingConfig';

const PASOS = ['Cuenta', 'Tu local', 'Personalizá'] as const;

function emailValido(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

/** Indicador de pasos del onboarding. */
function Stepper({ paso }: { paso: number }) {
  return (
    <ol className="flex items-center gap-2">
      {PASOS.map((label, i) => {
        const hecho = i < paso;
        const actual = i === paso;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                hecho
                  ? 'bg-primary text-primary-foreground'
                  : actual
                    ? 'border-2 border-primary text-primary'
                    : 'border text-muted-foreground'
              }`}
            >
              {hecho ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={`hidden text-sm sm:inline ${actual ? 'font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < PASOS.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Wizard de registro + onboarding de un local nuevo (3 pasos + éxito). */
export function RegistroWizard({ dominioBase }: { dominioBase: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState(0); // 0..2 = pasos; 3 = éxito
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nombreLocal, setNombreLocal] = useState('');
  const [subdominioRaw, setSubdominioRaw] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [colorMarca, setColorMarca] = useState<ColorMarca>('terracota');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subdominio = normalizarSubdominio(subdominioRaw);
  const errorSub = subdominioRaw.length > 0 ? validarSubdominio(subdominio) : null;
  const proto = dominioBase.includes('localhost') ? 'http' : 'https';

  const okPaso1 = emailValido(email) && password.length >= 8 && password === password2;
  const okPaso2 = nombreLocal.trim().length >= 2 && !errorSub && subdominio.length >= SUBDOMINIO_MIN;
  const okPaso3 = aceptaTerminos;

  const crear = useMutation({
    mutationFn: async () => {
      if (!aceptaTerminos) {
        throw new Error('Tenés que aceptar los términos y la política de privacidad.');
      }
      const res = await registrarLocalAction({
        email,
        password,
        nombreLocal,
        subdominio: subdominioRaw,
        descripcion,
        direccion,
        colorMarca,
      });
      if (!res.success) {
        const err = new Error(res.message) as Error & { campo?: CampoRegistro };
        err.campo = res.campo;
        throw err;
      }
      // Iniciamos sesión con la cuenta recién creada para dejarla logueada.
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      return res;
    },
    onSuccess: () => {
      setErrorMsg(null);
      setPaso(3);
    },
    onError: (e) => {
      const campo = (e as { campo?: CampoRegistro }).campo;
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo crear el local.');
      if (campo === 'email' || campo === 'password') setPaso(0);
      else if (campo === 'nombreLocal' || campo === 'subdominio') setPaso(1);
    },
  });

  const irA = (p: number) => {
    setErrorMsg(null);
    setPaso(p);
  };

  // ---- Pantalla de éxito ----
  if (paso === 3) {
    const url = `${subdominio}.${dominioBase}`;
    return (
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
          <Check className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-semibold">¡Tu local está creado!</h1>
        <p className="mt-2 text-muted-foreground">
          Tu página pública quedó en{' '}
          <a
            href={`${proto}://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            {url}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
        <ol className="mt-5 space-y-2 rounded-xl border bg-muted/40 p-4 text-left text-sm">
          <li className="flex gap-2">
            <span className="font-semibold text-primary">1.</span>
            <span>Cargá el menú (productos y precios)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary">2.</span>
            <span>Armá el salón y generá los QR de mesa</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary">3.</span>
            <span>Vinculá Mercado Pago para cobrar</span>
          </li>
        </ol>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => router.push('/admin')}>
            Configurar mi local
          </Button>
          <Button variant="outline" asChild>
            <a href={`${proto}://${url}`} target="_blank" rel="noopener noreferrer">
              Ver mi página
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // ---- Wizard ----
  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-semibold">acomer</span>
          <span className="text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Ingresá
            </Link>
          </span>
        </div>
        <Stepper paso={paso} />
      </div>

      {errorMsg ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{errorMsg}</p>
        </div>
      ) : null}

      {/* Paso 1: Cuenta */}
      {paso === 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Creá tu cuenta</h2>
            <p className="text-sm text-muted-foreground">Vas a usarla para entrar a tu panel.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-pass">Contraseña</Label>
            <Input
              id="reg-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-pass2">Repetir contraseña</Label>
            <Input
              id="reg-pass2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              aria-invalid={password2.length > 0 && password2 !== password}
            />
            {password2.length > 0 && password2 !== password ? (
              <p className="text-sm text-destructive">Las contraseñas no coinciden.</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Paso 2: Tu local */}
      {paso === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Tu local</h2>
            <p className="text-sm text-muted-foreground">El nombre y la dirección web de tu local.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-nombre">Nombre del local</Label>
            <Input
              id="reg-nombre"
              value={nombreLocal}
              onChange={(e) => setNombreLocal(e.target.value)}
              maxLength={80}
              placeholder="La Esquina"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-sub">Subdominio</Label>
            <div className="flex items-center gap-2">
              <Input
                id="reg-sub"
                value={subdominioRaw}
                onChange={(e) => setSubdominioRaw(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="la-esquina"
                className="max-w-[15rem]"
                aria-invalid={!!errorSub}
              />
              <span className="text-sm text-muted-foreground">.{dominioBase}</span>
            </div>
            {errorSub ? (
              <p className="text-sm text-destructive">{errorSub}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tu local quedará en{' '}
                <span className="font-medium text-foreground">
                  {subdominio || 'tu-local'}.{dominioBase}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Paso 3: Personalizá (opcional) */}
      {paso === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Personalizá tu página</h2>
            <p className="text-sm text-muted-foreground">Opcional: lo podés cambiar después en Configuración.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-desc">Descripción</Label>
            <Textarea
              id="reg-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Cocina de barrio · Parrilla · Pastas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-dir">Dirección</Label>
            <Input
              id="reg-dir"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              maxLength={200}
              placeholder="Av. Corrientes 1234"
            />
          </div>
          <div className="space-y-2">
            <Label>Color de marca</Label>
            <div className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-lg border"
                style={{ background: GRADIENTE_MARCA[colorMarca] }}
                aria-hidden
              />
              <Select value={colorMarca} onValueChange={(v) => setColorMarca(v as ColorMarca)}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORES_MARCA.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span className="text-muted-foreground">
              Acepto los{' '}
              <Link href="/terminos" target="_blank" className="font-medium text-primary hover:underline">
                términos y condiciones
              </Link>{' '}
              y la{' '}
              <Link href="/privacidad" target="_blank" className="font-medium text-primary hover:underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
        </div>
      )}

      {/* Navegación */}
      <div className="mt-6 flex items-center justify-between gap-3">
        {paso > 0 ? (
          <Button variant="ghost" onClick={() => irA(paso - 1)} disabled={crear.isPending}>
            <ArrowLeft className="size-4" /> Atrás
          </Button>
        ) : (
          <span />
        )}

        {paso === 0 && (
          <Button onClick={() => irA(1)} disabled={!okPaso1}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        )}
        {paso === 1 && (
          <Button onClick={() => irA(2)} disabled={!okPaso2}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        )}
        {paso === 2 && (
          <Button onClick={() => crear.mutate()} disabled={crear.isPending || !okPaso3}>
            {crear.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creando…
              </>
            ) : (
              'Crear mi local'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
