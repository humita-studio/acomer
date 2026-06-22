// Tipos del flujo de venta de mostrador. El carrito se arma local en el modal
// (CartLine) y recién se persiste al cobrar.

export type CartLine = {
  key: string;
  productoId: string | null; // null = ítem libre
  varianteId?: string | null; // presentación elegida (precio fijo)
  nombre: string;
  precioUnitario: number; // precio base/variante + adicionales (unitario)
  cantidad: number;
  modificadorIds: string[];
  modificadoresNombres: string[];
  nombreLibre?: string;
  precioLibre?: number;
};

export type Metodo = 'efectivo' | 'tarjeta_fisica' | 'mercado_pago';
export type Step = 'armando' | 'cobrando' | 'mp_esperando' | 'cobrada';

export type MpData = {
  sesionId: string;
  transactionId: string;
  pedidoId: string;
  paymentUrl: string;
  subtotal: number;
  descuento: number;
  total: number;
  cantidadItems: number;
};

export const METODO_LABEL: Record<Metodo, string> = {
  efectivo: 'Efectivo',
  tarjeta_fisica: 'Tarjeta',
  mercado_pago: 'Mercado Pago',
};
