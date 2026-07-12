import { z } from 'zod';

/**
 * IDs de Postgres (`uuid`). Usamos `guid` (hex 8-4-4-4-12) y no `uuid` RFC:
 * Zod 4 rechaza IDs válidos en PG como el tenant demo
 * `11111111-1111-1111-1111-111111111111` (variante no RFC).
 */
export const uuidSchema = z.guid({ error: 'ID inválido' });

export const pedirCuentaSchema = z.object({
  sesionMesaId: uuidSchema,
  tenantId: uuidSchema,
  currentUrl: z.url({ error: 'URL de retorno inválida' }).max(2000),
});

export const pedirCuentaPresencialSchema = z.object({
  sesionMesaId: uuidSchema,
  tenantId: uuidSchema,
  metodoPago: z.enum(['efectivo', 'tarjeta_fisica']),
  omitirPromoIds: z.array(uuidSchema).max(50).optional(),
});

export const aprobarPagoSchema = z.object({
  transactionId: uuidSchema,
  montoRecibido: z.number().finite().nonnegative().optional(),
});

export type PedirCuentaInput = z.infer<typeof pedirCuentaSchema>;
export type PedirCuentaPresencialInput = z.infer<typeof pedirCuentaPresencialSchema>;
