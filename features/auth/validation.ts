import { z } from 'zod';

const roleSchema = z.enum(['owner', 'admin', 'cajero', 'mozo', 'cocina']);

export const inviteEmployeeSchema = z.object({
  email: z.string().trim().email('Email inválido').max(254),
  rol: roleSchema,
});

export const updateEmployeeRoleSchema = z.object({
  perfilId: z.guid({ error: 'ID de perfil inválido' }),
  nuevoRol: roleSchema,
});

export const perfilIdSchema = z.object({
  perfilId: z.guid({ error: 'ID de perfil inválido' }),
});
