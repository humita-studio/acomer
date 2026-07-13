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

export interface InviteEmployeeInput {
  email: string;
  rol: RoleType;
}

export interface InviteEmployeeResult {
  success: boolean;
  message: string;
  userId?: string;
  /**
   * Contraseña temporal generada, presente SOLO cuando se crea una cuenta
   * nueva. El admin debe entregarla al empleado; no se guarda ni se vuelve a
   * mostrar. Si el usuario ya existía en Auth no se incluye (conserva su clave).
   */
  tempPassword?: string;
}

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
 */
export async function inviteEmployee(
  input: InviteEmployeeInput
): Promise<InviteEmployeeResult> {
  try {
    const session = await getCurrentSession();
    
    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tienes permisos para invitar empleados',
      };
    }

    const parsed = inviteEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      };
    }

    // El cliente admin usa la secret key: las operaciones auth.admin requieren
    // privilegios elevados que la publishable key no tiene.
    const supabase = createSupabaseAdminClient();
    const email = parsed.data.email.trim().toLowerCase();
    const tempPassword = generateTempPassword();

    // 1. Buscar o crear el usuario en Supabase Auth.
    // must_change_password: al primer login se fuerza /cambiar-password.
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { [META_MUST_CHANGE_PASSWORD]: true },
    });

    // Solo hay contraseña temporal que mostrar si creamos una cuenta nueva.
    const createdNewUser = Boolean(signUpData?.user && !signUpError);
    let finalUserId: string | undefined = signUpData?.user?.id;

    if (signUpError || !signUpData.user) {
      // Si ya existe en Auth, lo buscamos para asociarlo a este restaurante.
      const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
      const existingUser = userData?.users.find(
        (u) => u.email?.toLowerCase() === email
      );

      if (!existingUser) {
        console.error('[inviteEmployee] No se pudo crear el usuario:', signUpError, listError);
        return {
          success: false,
          message: 'Error al crear la cuenta del empleado',
        };
      }

      // Verificar si ya tiene un perfil en este restaurante
      const existingPerfil = await withTenant(claimsFromSession(session), (tx) =>
        tx
          .select()
          .from(perfilesEmpleados)
          .where(
            and(
              eq(perfilesEmpleados.userId, existingUser.id),
              eq(perfilesEmpleados.restauranteId, session.restauranteId),
            ),
          )
          .limit(1),
      );

      if (existingPerfil[0]) {
        return {
          success: false,
          message: 'El empleado ya está invitado a este restaurante',
        };
      }

      finalUserId = existingUser.id;
    }

    if (!finalUserId) {
      return { success: false, message: 'No se pudo determinar el ID del usuario' };
    }

    // 2. Crear el perfil del empleado en la tabla perfiles_empleados
    await withTenant(claimsFromSession(session), (tx) =>
      tx.insert(perfilesEmpleados).values({
        userId: finalUserId!,
        restauranteId: session.restauranteId,
        rol: parsed.data.rol,
        activo: true,
      }),
    );

    // 3. Devolver la contraseña temporal solo si creamos la cuenta. Si el
    // usuario ya existía en Auth, conserva su contraseña y debe usar esa.
    if (createdNewUser) {
      return {
        success: true,
        message: `${email} fue agregado como ${parsed.data.rol}. Entregale la contraseña temporal: al ingresar se le pedirá elegir una propia.`,
        userId: finalUserId,
        tempPassword,
      };
    }

    return {
      success: true,
      message: `${email} ya tenía cuenta y fue agregado como ${parsed.data.rol}. Que ingrese con su contraseña actual.`,
      userId: finalUserId,
    };
  } catch (error) {
    console.error('[inviteEmployee] Error:', error);
    return {
      success: false,
      message: 'Error al invitar al empleado',
    };
  }
}

/**
 * Actualiza el rol de un empleado.
 */
export async function updateEmployeeRole(
  perfilId: string,
  nuevoRol: RoleType
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    
    if (!session || !['owner', 'admin'].includes(session.role)) {
      return {
        success: false,
        message: 'No tienes permisos para actualizar empleados',
      };
    }

    const parsed = updateEmployeeRoleSchema.safeParse({ perfilId, nuevoRol });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }

    // Solo owner puede cambiar el rol de admin
    if (parsed.data.nuevoRol === 'admin' && session.role !== 'owner') {
      return {
        success: false,
        message: 'Solo el propietario puede crear administradores',
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
      message: `Rol actualizado a ${parsed.data.nuevoRol}`,
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
        message: 'No tienes permisos para desactivar empleados',
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
        message: 'No tienes permisos para activar empleados',
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
