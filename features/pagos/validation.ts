import { z } from 'zod';

/** UUID v4-ish (acepta cualquier uuid string de la app). */
export const uuidSchema = z.string().uuid('ID inválido');

export const pedirCuentaSchema = z.object({
  sesionMesaId: uuidSchema,
  tenantId: uuidSchema,
  currentUrl: z.string().url('URL de retorno inválida').max(2000),
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
