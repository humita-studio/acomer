'use server';

import { randomInt } from 'crypto';
import { perfilesEmpleados } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import type { RoleType } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import {
  inviteEmployeeSchema,
  updateEmployeeRoleSchema,
  perfilIdSchema,
} from './validation';
import { META_MUST_CHANGE_PASSWORD } from './auth-errors';

/** Roles que se pueden asignar al invitar (nunca owner). */
export type AssignableRole = Exclude<RoleType, 'owner'>;

/** Cómo se entrega el acceso al empleado nuevo. */
export type InviteMethod = 'temp' | 'email';

export interface InviteEmployeeInput {
  email: string;
  rol: AssignableRole;
  /** `temp` (default): contraseña temporal. `email`: link de invitación de Supabase. */
  method?: InviteMethod;
}

export interface InviteEmployeeResult {
  success: boolean;
  message: string;
  userId?: string;
  /**
   * Contraseña temporal generada, presente SOLO cuando se crea una cuenta
   * nueva con método `temp`. El admin debe entregarla al empleado; no se
   * guarda ni se vuelve a mostrar. Si el usuario ya existía en Auth no se
   * incluye (conserva su clave).
   */
  tempPassword?: string;
}

export interface ResetEmployeePasswordResult {
  success: boolean;
  message: string;
  email?: string;
  /** Contraseña temporal nueva; se muestra una sola vez. */
  tempPassword?: string;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function inviteRedirectTo(): string {
  return `${appUrl()}/auth/callback?next=${encodeURIComponent('/cambiar-password')}`;
}

const ROL_LABEL: Record<AssignableRole, string> = {
  admin: 'administrador',
  cajero: 'cajero',
  mozo: 'mozo',
  cocina: 'cocina',
};

/**
 * Genera una contraseña temporal legible (3 grupos de 4 caracteres, sin
 * caracteres ambiguos como l/1/0/o) usando un RNG criptográfico.
 * Ej: "k7qm-3xtp-9abd".
 */
function generateTempPassword(): string {
  const charset = 'abcdefghijkmnpqrstuvwxyz23456789'; // sin l, o, 0, 1
  const groups = 3;
  const groupLength = 4;
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let part = '';
    for (let i = 0; i < groupLength; i++) {
      part += charset[randomInt(charset.length)];
    }
    parts.push(part);
  }
  return parts.join('-');
}

/**
 * Invita a un empleado a unirse al restaurante.
 * Solo owner y admin pueden invitar.
 *
 * Métodos:
 * - `temp` (default): crea cuenta con contraseña temporal (recomendado en local).
 * - `email`: manda link de invitación de Supabase (requiere email configurado).
 */
export async function inviteEmployee(
  input: InviteEmployeeInput
): Promise<InviteEmployeeResult> {
  try {
    const session = await getCurrentSession();
    
    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tenés permisos para invitar empleados',
      };
    }

    const parsed = inviteEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      };
    }

    // Solo el owner puede invitar administradores.
    if (parsed.data.rol === 'admin' && session.role !== 'owner') {
      return {
        success: false,
        message: 'Solo el propietario puede invitar administradores',
      };
    }

    // El cliente admin usa la secret key: las operaciones auth.admin requieren
    // privilegios elevados que la publishable key no tiene.
    const supabase = createSupabaseAdminClient();
    const email = parsed.data.email.trim().toLowerCase();
    const method = parsed.data.method ?? 'temp';
    const rolLabel = ROL_LABEL[parsed.data.rol];
    const claims = claimsFromSession(session);

    // ¿Ya tiene perfil en este local?
    const existingByEmail = await findAuthUserByEmail(supabase, email);
    if (existingByEmail) {
      const existingPerfil = await withTenant(claims, (tx) =>
        tx
          .select()
          .from(perfilesEmpleados)
          .where(
            and(
              eq(perfilesEmpleados.userId, existingByEmail.id),
              eq(perfilesEmpleados.restauranteId, session.restauranteId),
            ),
          )
          .limit(1),
      );

      if (existingPerfil[0]) {
        if (existingPerfil[0].activo) {
          return {
            success: false,
            message: 'Ese email ya está invitado a este local',
          };
        }
        await withTenant(claims, (tx) =>
          tx
            .update(perfilesEmpleados)
            .set({
              activo: true,
              rol: parsed.data.rol,
              updatedAt: new Date(),
            })
            .where(eq(perfilesEmpleados.id, existingPerfil[0].id)),
        );
        return {
          success: true,
          message: `${email} ya tenía cuenta: se reactivó como ${rolLabel}. Que ingrese con su contraseña actual.`,
          userId: existingByEmail.id,
        };
      }

      // Usuario Auth existe pero no en este local: solo asociamos el perfil.
      await withTenant(claims, (tx) =>
        tx.insert(perfilesEmpleados).values({
          userId: existingByEmail.id,
          restauranteId: session.restauranteId,
          rol: parsed.data.rol,
          activo: true,
        }),
      );
      return {
        success: true,
        message: `${email} ya tenía cuenta y fue agregado como ${rolLabel}. Que ingrese con su contraseña actual.`,
        userId: existingByEmail.id,
      };
    }

    // --- Usuario nuevo ---
    if (method === 'email') {
      const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        email,
        {
          data: { [META_MUST_CHANGE_PASSWORD]: true },
          redirectTo: inviteRedirectTo(),
        },
      );

      if (inviteError || !invited.user) {
        console.error('[inviteEmployee] inviteUserByEmail:', inviteError);
        return {
          success: false,
          message:
            'No se pudo enviar el email de invitación. Probá con contraseña temporal o revisá el SMTP de Supabase.',
        };
      }

      await withTenant(claims, (tx) =>
        tx.insert(perfilesEmpleados).values({
          userId: invited.user.id,
          restauranteId: session.restauranteId,
          rol: parsed.data.rol,
          activo: true,
        }),
      );

      return {
        success: true,
        message: `Invitación enviada a ${email} como ${rolLabel}. Que revise su bandeja (y spam) y elija contraseña desde el link.`,
        userId: invited.user.id,
      };
    }

    // Método temp: crear con contraseña temporal legible.
    const tempPassword = generateTempPassword();
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { [META_MUST_CHANGE_PASSWORD]: true },
    });

    if (signUpError || !signUpData.user) {
      console.error('[inviteEmployee] createUser:', signUpError);
      return {
        success: false,
        message: 'No se pudo crear la cuenta del empleado. Probá de nuevo.',
      };
    }

    await withTenant(claims, (tx) =>
      tx.insert(perfilesEmpleados).values({
        userId: signUpData.user.id,
        restauranteId: session.restauranteId,
        rol: parsed.data.rol,
        activo: true,
      }),
    );

    return {
      success: true,
      message: `${email} fue agregado como ${rolLabel}. Entregale la contraseña temporal: al ingresar se le pedirá elegir una propia.`,
      userId: signUpData.user.id,
      tempPassword,
    };
  } catch (error) {
    console.error('[inviteEmployee] Error:', error);
    return {
      success: false,
      message: 'Error al invitar al empleado',
    };
  }
}

/** Busca un usuario de Auth por email (paginado; alcanza para locales chicos). */
async function findAuthUserByEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('[findAuthUserByEmail]', error);
    return null;
  }
  const found = data?.users.find((u) => u.email?.toLowerCase() === email);
  return found ? { id: found.id, email: found.email } : null;
}

/**
 * Genera una contraseña temporal nueva para un empleado y fuerza el cambio
 * al próximo login. Se muestra una sola vez al admin.
 */
export async function resetEmployeePassword(
  perfilId: string,
): Promise<ResetEmployeePasswordResult> {
  try {
    const session = await getCurrentSession();

    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tenés permisos para resetear contraseñas',
      };
    }

    const parsed = perfilIdSchema.safeParse({ perfilId });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    const [target] = await withTenant(claimsFromSession(session), (tx) =>
      tx
        .select({
          id: perfilesEmpleados.id,
          userId: perfilesEmpleados.userId,
          rol: perfilesEmpleados.rol,
          activo: perfilesEmpleados.activo,
        })
        .from(perfilesEmpleados)
        .where(
          and(
            eq(perfilesEmpleados.id, parsed.data.perfilId),
            eq(perfilesEmpleados.restauranteId, session.restauranteId),
          ),
        )
        .limit(1),
    );

    if (!target) {
      return { success: false, message: 'Empleado no encontrado' };
    }
    if (target.rol === 'owner') {
      return {
        success: false,
        message: 'No se puede resetear la contraseña del propietario desde acá',
      };
    }
    if (target.userId === session.user.id) {
      return {
        success: false,
        message: 'Para cambiar tu contraseña usá “Olvidé mi contraseña” en el login',
      };
    }
    if (target.rol === 'admin' && session.role !== 'owner') {
      return {
        success: false,
        message: 'Solo el propietario puede resetear la contraseña de un administrador',
      };
    }
    if (!target.activo) {
      return {
        success: false,
        message: 'Activá al empleado antes de resetearle la contraseña',
      };
    }

    const supabase = createSupabaseAdminClient();
    const tempPassword = generateTempPassword();

    const { data: updated, error } = await supabase.auth.admin.updateUserById(target.userId, {
      password: tempPassword,
      user_metadata: { [META_MUST_CHANGE_PASSWORD]: true },
    });

    if (error) {
      console.error('[resetEmployeePassword]', error);
      return {
        success: false,
        message: 'No se pudo generar la nueva contraseña. Probá de nuevo.',
      };
    }

    const email = updated.user.email?.toLowerCase() ?? '';

    return {
      success: true,
      message: `Nueva contraseña temporal para ${email || 'el empleado'}. Entregásela: al ingresar deberá elegir una propia.`,
      email: email || undefined,
      tempPassword,
    };
  } catch (error) {
    console.error('[resetEmployeePassword] Error:', error);
    return {
      success: false,
      message: 'Error al resetear la contraseña',
    };
  }
}

/**
 * Actualiza el rol de un empleado.
 */
export async function updateEmployeeRole(
  perfilId: string,
  nuevoRol: AssignableRole,
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    
    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tenés permisos para actualizar empleados',
      };
    }

    const parsed = updateEmployeeRoleSchema.safeParse({ perfilId, nuevoRol });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    // Solo owner puede asignar rol admin
    if (parsed.data.nuevoRol === 'admin' && session.role !== 'owner') {
      return {
        success: false,
        message: 'Solo el propietario puede asignar administradores',
      };
    }

    // No permitir cambiar el rol del owner del local.
    const [target] = await withTenant(claimsFromSession(session), (tx) =>
      tx
        .select({
          id: perfilesEmpleados.id,
          rol: perfilesEmpleados.rol,
        })
        .from(perfilesEmpleados)
        .where(
          and(
            eq(perfilesEmpleados.id, parsed.data.perfilId),
            eq(perfilesEmpleados.restauranteId, session.restauranteId),
          ),
        )
        .limit(1),
    );

    if (!target) {
      return { success: false, message: 'Empleado no encontrado' };
    }
    if (target.rol === 'owner') {
      return {
        success: false,
        message: 'No se puede cambiar el rol del propietario',
      };
    }

    await withTenant(claimsFromSession(session), (tx) =>
      tx
        .update(perfilesEmpleados)
        .set({ rol: parsed.data.nuevoRol, updatedAt: new Date() })
        .where(
          and(
            eq(perfilesEmpleados.id, parsed.data.perfilId),
            eq(perfilesEmpleados.restauranteId, session.restauranteId),
          ),
        ),
    );

    return {
      success: true,
      message: `Rol actualizado a ${ROL_LABEL[parsed.data.nuevoRol]}`,
    };
  } catch (error) {
    console.error('[updateEmployeeRole] Error:', error);
    return {
      success: false,
      message: 'Error al actualizar el rol',
    };
  }
}

/**
 * Desactiva un empleado.
 */
export async function deactivateEmployee(
  perfilId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    
    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tenés permisos para desactivar empleados',
      };
    }

    const parsed = perfilIdSchema.safeParse({ perfilId });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    await withTenant(claimsFromSession(session), (tx) =>
      tx
        .update(perfilesEmpleados)
        .set({ activo: false, updatedAt: new Date() })
        .where(
          and(
            eq(perfilesEmpleados.id, parsed.data.perfilId),
            eq(perfilesEmpleados.restauranteId, session.restauranteId),
          ),
        ),
    );

    return {
      success: true,
      message: 'Empleado desactivado',
    };
  } catch (error) {
    console.error('[deactivateEmployee] Error:', error);
    return {
      success: false,
      message: 'Error al desactivar el empleado',
    };
  }
}

/**
 * Reactiva un empleado previamente desactivado.
 */
export async function activateEmployee(
  perfilId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();

    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tenés permisos para activar empleados',
      };
    }

    const parsed = perfilIdSchema.safeParse({ perfilId });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    await withTenant(claimsFromSession(session), (tx) =>
      tx
        .update(perfilesEmpleados)
        .set({ activo: true, updatedAt: new Date() })
        .where(
          and(
            eq(perfilesEmpleados.id, parsed.data.perfilId),
            eq(perfilesEmpleados.restauranteId, session.restauranteId),
          ),
        ),
    );

    return {
      success: true,
      message: 'Empleado reactivado',
    };
  } catch (error) {
    console.error('[activateEmployee] Error:', error);
    return {
      success: false,
      message: 'Error al activar el empleado',
    };
  }
}

export interface EmployeeListItem {
  id: string;
  userId: string;
  email: string;
  rol: RoleType;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lista todos los empleados del restaurante, incluyendo el email (que vive en
 * Supabase Auth, no en la tabla perfiles_empleados).
 */
export async function listEmployees(): Promise<EmployeeListItem[]> {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return [];
    }

    const empleados = await withTenant(claimsFromSession(session), (tx) =>
      tx
        .select({
          id: perfilesEmpleados.id,
          userId: perfilesEmpleados.userId,
          rol: perfilesEmpleados.rol,
          activo: perfilesEmpleados.activo,
          createdAt: perfilesEmpleados.createdAt,
          updatedAt: perfilesEmpleados.updatedAt,
        })
        .from(perfilesEmpleados)
        .where(eq(perfilesEmpleados.restauranteId, session.restauranteId)),
    );

    // El email no está en la tabla: lo resolvemos por userId contra Auth.
    const emailPorUserId = new Map<string, string>();
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of data?.users ?? []) {
        if (u.email) emailPorUserId.set(u.id, u.email);
      }
    } catch (e) {
      console.error('[listEmployees] No se pudieron obtener los emails:', e);
    }

    return empleados.map((e) => ({
      id: e.id,
      userId: e.userId,
      email: emailPorUserId.get(e.userId) ?? '(sin email)',
      rol: e.rol as RoleType,
      activo: e.activo,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  } catch (error) {
    console.error('[listEmployees] Error:', error);
    return [];
  }
}
