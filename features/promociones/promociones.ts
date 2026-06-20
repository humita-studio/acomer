/**
 * Tipos y helpers compartidos de Promociones (sin 'use server': se importan
 * tanto en el cliente como en los actions).
 */

export type PromoTipo = 'porcentaje' | 'monto_fijo' | '2x1' | 'combo';
export type PromoAlcance = 'pedido' | 'categoria' | 'producto';
export type PromoCanal = 'mostrador' | 'salon' | 'delivery' | 'takeaway';
export type PromoMetodoPago = 'efectivo' | 'tarjeta' | 'mercado_pago';

/** Condiciones para que una promo aplique. Campos vacíos = sin esa condición. */
export type PromoCondiciones = {
  /** Atajo: el descuento solo cuando se paga en efectivo. */
  soloEfectivo?: boolean;
  /** Métodos de pago habilitados (si está vacío, todos). */
  metodosPago?: PromoMetodoPago[];
  /** Días de la semana en que aplica (0=Dom … 6=Sáb). Vacío = todos. */
  dias?: number[];
  /** Franja horaria "HH:MM". null = sin límite. */
  horaDesde?: string | null;
  horaHasta?: string | null;
  /** Canales de venta donde aplica. Vacío = todos. */
  canales?: PromoCanal[];
  /** Monto mínimo del pedido para que aplique. null = sin mínimo. */
  montoMinimo?: number | null;
};

export type Promocion = {
  id: string;
  nombre: string;
  tipo: PromoTipo;
  /** % (porcentaje), $ (monto_fijo), precio del combo (combo); 2x1 = 0. */
  valor: number;
  alcance: PromoAlcance;
  /** ids de categoría/producto involucrados (combo = lista de productos). */
  targetIds: string[];
  condiciones: PromoCondiciones;
  /** ISO o null. */
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  activa: boolean;
  prioridad: number;
};

export type PromocionInput = Omit<Promocion, 'id'>;

export const PROMO_TIPOS: PromoTipo[] = ['porcentaje', 'monto_fijo', '2x1', 'combo'];

export const PROMO_TIPO_LABEL: Record<PromoTipo, string> = {
  porcentaje: 'Porcentaje',
  monto_fijo: 'Monto fijo',
  '2x1': '2x1',
  combo: 'Combo',
};

export const PROMO_ALCANCE_LABEL: Record<PromoAlcance, string> = {
  pedido: 'Todo el pedido',
  categoria: 'Categoría',
  producto: 'Producto',
};

export const PROMO_CANALES: PromoCanal[] = ['mostrador', 'salon', 'delivery', 'takeaway'];

export const PROMO_CANAL_LABEL: Record<PromoCanal, string> = {
  mostrador: 'Mostrador',
  salon: 'Salón',
  delivery: 'Delivery',
  takeaway: 'Takeaway',
};

/** Etiqueta corta del tipo+valor para mostrar en listas (ej. "−10%", "2x1"). */
export function promoTipoBadge(tipo: PromoTipo, valor: number): string {
  switch (tipo) {
    case 'porcentaje':
      return `−${valor}%`;
    case 'monto_fijo':
      return `−$${valor}`;
    case '2x1':
      return '2x1';
    case 'combo':
      return 'Combo';
  }
}

/** Normaliza una hora "H:MM"/"HH:MM" a "HH:MM" o null si es inválida. */
export function normalizarHoraPromo(h?: string | null): string | null {
  if (!h) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
