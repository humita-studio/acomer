import { z } from 'zod';

// guid (hex 8-4-4-4-12): Postgres acepta UUIDs no-RFC (p.ej. tenant demo).
const uuid = z.guid();

export const cartItemSchema = z.object({
  productoId: uuid,
  varianteId: uuid.nullable().optional(),
  cantidad: z.number().int().positive().max(99),
  modificadores: z
    .array(z.object({ id: uuid }))
    .max(30)
    .optional()
    .default([]),
});

export const checkoutExternoSchema = z.object({
  tenantId: uuid,
  modo: z.enum(['takeaway', 'delivery']),
  items: z.array(cartItemSchema).min(1).max(50),
  nombre: z.string().trim().min(1).max(120),
  telefono: z.string().trim().min(6).max(40),
  direccion: z.string().trim().max(300).optional(),
  notas: z.string().trim().max(500).optional(),
});

export type CheckoutExternoInput = z.infer<typeof checkoutExternoSchema>;
