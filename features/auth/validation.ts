import { z } from 'zod';

/** Roles que se pueden asignar al invitar o editar un empleado (nunca `owner`). */
export const assignableRoleSchema = z.enum(['admin', 'cajero', 'mozo', 'cocina']);

/** Cómo se entrega el acceso al empleado nuevo. */
export const inviteMethodSchema = z.enum(['temp', 'email']);

export const inviteEmployeeSchema = z.object({
  email: z.string().trim().email('Email inválido').max(254),
  rol: assignableRoleSchema,
  method: inviteMethodSchema.default('temp'),
});

export const updateEmployeeRoleSchema = z.object({
  perfilId: z.guid({ error: 'ID de perfil inválido' }),
  nuevoRol: assignableRoleSchema,
});

export const perfilIdSchema = z.object({
  perfilId: z.guid({ error: 'ID de perfil inválido' }),
});
