'use server';

import { db } from '@/shared/db';
import { perfilesEmpleados } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { getCurrentSession } from '@/features/auth/session';
import type { RoleType } from '@/features/authorization/roles';

export interface InviteEmployeeInput {
  email: string;
  rol: RoleType;
}

export interface InviteEmployeeResult {
  success: boolean;
  message: string;
  userId?: string;
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

    // El cliente admin usa la secret key: las operaciones auth.admin requieren
    // privilegios elevados que la publishable key no tiene.
    const supabase = createSupabaseAdminClient();
    const email = input.email.trim().toLowerCase();

    // 1. Buscar o crear el usuario en Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(-12), // Contraseña temporal
      email_confirm: true,
    });

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
      const existingPerfil = await db
        .select()
        .from(perfilesEmpleados)
        .where(
          and(
            eq(perfilesEmpleados.userId, existingUser.id),
            eq(perfilesEmpleados.restauranteId, session.restauranteId)
          )
        )
        .limit(1);

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
    const [nuevoPerfiles] = await db
      .insert(perfilesEmpleados)
      .values({
        userId: finalUserId,
        restauranteId: session.restauranteId,
        rol: input.rol,
        activo: true,
      })
      .returning();

    // 3. Enviar correo de invitación (opcional, puede integrarse con SendGrid o similar)
    // Por ahora, solo registramos la invitación

    return {
      success: true,
      message: `${input.email} ha sido invitado como ${input.rol}`,
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

    // Solo owner puede cambiar el rol de admin
    if (nuevoRol === 'admin' && session.role !== 'owner') {
      return {
        success: false,
        message: 'Solo el propietario puede crear administradores',
      };
    }

    await db
      .update(perfilesEmpleados)
      .set({ rol: nuevoRol, updatedAt: new Date() })
      .where(
        and(
          eq(perfilesEmpleados.id, perfilId),
          eq(perfilesEmpleados.restauranteId, session.restauranteId)
        )
      );

    return {
      success: true,
      message: `Rol actualizado a ${nuevoRol}`,
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

    await db
      .update(perfilesEmpleados)
      .set({ activo: false, updatedAt: new Date() })
      .where(
        and(
          eq(perfilesEmpleados.id, perfilId),
          eq(perfilesEmpleados.restauranteId, session.restauranteId)
        )
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
 * Lista todos los empleados del restaurante.
 */
export async function listEmployees() {
  try {
    const session = await getCurrentSession();
    
    if (!session) {
      return [];
    }

    const empleados = await db
      .select({
        id: perfilesEmpleados.id,
        userId: perfilesEmpleados.userId,
        rol: perfilesEmpleados.rol,
        activo: perfilesEmpleados.activo,
        createdAt: perfilesEmpleados.createdAt,
        updatedAt: perfilesEmpleados.updatedAt,
      })
      .from(perfilesEmpleados)
      .where(eq(perfilesEmpleados.restauranteId, session.restauranteId));

    return empleados;
  } catch (error) {
    console.error('[listEmployees] Error:', error);
    return [];
  }
}
