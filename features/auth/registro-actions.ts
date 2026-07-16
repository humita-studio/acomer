'use server';

import { db } from '@/shared/db';
import { restaurantes, perfilesEmpleados, landingConfig } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { normalizarSubdominio, validarSubdominio } from '@/features/tenant/subdominio';
import type { ColorMarca } from '@/features/landing/landingConfig';
import { trialEndsAtFromNow } from '@/features/billing/plans';

const PASSWORD_MIN = 8;
const COLORES_VALIDOS: ColorMarca[] = ['terracota', 'ambar', 'verde'];

/** Campos del wizard, para que el front salte al paso con el error. */
export type CampoRegistro = 'email' | 'password' | 'nombreLocal' | 'subdominio';

export type RegistroLocalInput = {
  email: string;
  password: string;
  nombreLocal: string;
  subdominio: string;
  // Personalización opcional de la landing (paso saltable).
  descripcion?: string;
  direccion?: string;
  colorMarca?: ColorMarca;
};

export type RegistroLocalResult = {
  success: boolean;
  message: string;
  slug?: string;
  campo?: CampoRegistro;
};

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** ¿El error de createUser indica que el email ya tiene cuenta? */
function esEmailDuplicado(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  return m.includes('already') || m.includes('registered') || m.includes('exists');
}

/**
 * Alta de un local nuevo (onboarding): crea la cuenta en Supabase Auth, el
 * restaurante, el perfil `owner` y, si vinieron, los datos de landing. Si algo
 * falla después de crear el usuario, lo elimina para no dejar cuentas huérfanas.
 */
export async function registrarLocalAction(input: RegistroLocalInput): Promise<RegistroLocalResult> {
  const { rateLimit } = await import('@/shared/lib/rateLimit');
  const { getClientIp } = await import('@/shared/lib/clientIp');
  const ip = await getClientIp();
  const rl = rateLimit(`registro:${ip}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return { success: false, message: rl.message };
  }

  // 1. Validaciones (server-side; el front valida en vivo pero esto es la red de seguridad)
  const email = (input.email ?? '').trim().toLowerCase();
  if (!emailValido(email)) {
    return { success: false, message: 'Ingresá un email válido.', campo: 'email' };
  }
  if ((input.password ?? '').length < PASSWORD_MIN) {
    return {
      success: false,
      message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
      campo: 'password',
    };
  }
  const nombre = (input.nombreLocal ?? '').trim().slice(0, 80);
  if (nombre.length < 2) {
    return { success: false, message: 'Ingresá el nombre de tu local.', campo: 'nombreLocal' };
  }
  const slug = normalizarSubdominio(input.subdominio);
  const errorSlug = validarSubdominio(slug);
  if (errorSlug) {
    return { success: false, message: errorSlug, campo: 'subdominio' };
  }

  // 2. ¿El subdominio ya está tomado?
  const [tomado] = await db
    .select({ id: restaurantes.id })
    .from(restaurantes)
    .where(eq(restaurantes.slug, slug))
    .limit(1);
  if (tomado) {
    return { success: false, message: 'Ese subdominio ya está en uso.', campo: 'subdominio' };
  }

  // 3. Crear el usuario en Supabase Auth (auto-confirmado para que pueda entrar ya)
  const supabase = createSupabaseAdminClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });

  if (signUpError || !signUpData?.user) {
    if (esEmailDuplicado(signUpError?.message)) {
      return {
        success: false,
        message: 'Ese email ya tiene una cuenta. Iniciá sesión.',
        campo: 'email',
      };
    }
    console.error('[registrarLocalAction] createUser:', signUpError);
    return { success: false, message: 'No se pudo crear la cuenta. Probá de nuevo.', campo: 'email' };
  }

  const userId = signUpData.user.id;

  // 4. Crear restaurante + perfil owner (+ landing opcional). Si algo falla,
  //    borramos el usuario recién creado para no dejar cuentas huérfanas.
  try {
    const [rest] = await db
      .insert(restaurantes)
      .values({
        nombre,
        slug,
        plan: 'pro',
        billingStatus: 'trial',
        trialEndsAt: trialEndsAtFromNow(),
      })
      .returning({ id: restaurantes.id });

    await db.insert(perfilesEmpleados).values({
      userId,
      restauranteId: rest.id,
      rol: 'owner',
      activo: true,
    });

    const colorMarca =
      input.colorMarca && COLORES_VALIDOS.includes(input.colorMarca) ? input.colorMarca : undefined;
    const descripcion = (input.descripcion ?? '').trim().slice(0, 200);
    const direccion = (input.direccion ?? '').trim().slice(0, 200);

    if (descripcion || direccion || colorMarca) {
      await db.insert(landingConfig).values({
        restauranteId: rest.id,
        descripcion,
        direccion,
        ...(colorMarca ? { colorMarca } : {}),
      });
    }

    return { success: true, message: '¡Local creado!', slug };
  } catch (error) {
    // Rollback del usuario de Auth (las inserts en DB son independientes).
    await supabase.auth.admin.deleteUser(userId).catch(() => {});

    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('slug') || msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, message: 'Ese subdominio ya está en uso.', campo: 'subdominio' };
    }
    console.error('[registrarLocalAction] alta local:', error);
    return { success: false, message: 'No se pudo crear el local. Probá de nuevo.' };
  }
}
