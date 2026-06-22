// Modelo de dominio de caja. Fuente única de tipos compartidos entre
// hooks, actions y componentes de la feature.

export type TipoMovimiento = 'ingreso' | 'egreso' | 'retiro';

export type MovimientoCaja = {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  concepto: string | null;
  createdAt: Date;
};

export type CajaActual = {
  id: string;
  montoInicial: number;
  abiertaAt: Date;
  abiertaPor: string;
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasMercadoPago: number;
  ingresos: number;
  egresos: number;
  retiros: number;
  esperadoEnCaja: number;
  movimientos: MovimientoCaja[];
};

export type CajaCerrada = {
  id: string;
  abiertaAt: Date;
  cerradaAt: Date | null;
  montoInicial: number;
  montoEsperado: number;
  montoFinalContado: number;
  diferencia: number;
};

/**
 * Desglose completo de un cierre, recomputado a demanda para el modal de
 * detalle. Las ventas se acotan a la ventana [abiertaAt, cerradaAt] de la caja.
 */
export type DetalleCierre = {
  id: string;
  abiertaAt: Date;
  cerradaAt: Date | null;
  montoInicial: number;
  ventasEfectivo: number;
  ingresos: number;
  egresos: number;
  retiros: number;
  esperado: number;
  contado: number;
  diferencia: number;
};
