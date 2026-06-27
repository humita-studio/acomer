// Modelo de dominio de cobros (transacciones de pago presencial pendientes
// de aprobación en caja).

export type TransaccionCobro = {
  id: string;
  monto: string;
  descuento: string;
  proveedor: string;
  estado: string;
  fecha: Date;
  sesionMesaId: string;
  mesaIdentificador: string;
  /** Metadatos del cobro (vuelto, monto recibido, etc.). */
  metadata?: Record<string, unknown> | null;
  /** Fecha en que fue aprobado o rechazado. */
  resueltaAt?: Date | null;
};
