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
};
