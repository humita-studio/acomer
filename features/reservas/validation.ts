import { z } from 'zod';

// guid (hex 8-4-4-4-12): Postgres acepta UUIDs no-RFC (p.ej. tenant demo).
const uuid = z.guid();

export const crearReservaPublicaSchema = z.object({
  tenantId: uuid,
  nombre: z.string().trim().min(1).max(120),
  telefono: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  personas: z.number().int().min(1).max(50),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  notas: z.string().trim().max(500).optional(),
});

export type CrearReservaPublicaInput = z.infer<typeof crearReservaPublicaSchema>;
