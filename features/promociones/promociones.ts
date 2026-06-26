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

/** Días de la semana para los chips del formulario (0=Dom). */
export const PROMO_DIAS: { label: string; value: number }[] = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'X', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];

/** Métodos de pago para los chips de condiciones. */
export const PROMO_METODOS: { label: string; value: PromoMetodoPago }[] = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Tarjeta', value: 'tarjeta' },
  { label: 'Mercado Pago', value: 'mercado_pago' },
];

/** Mapea el tipo de sesión (salon/takeaway/delivery/mostrador) al canal de promo. */
export function canalDeTipoSesion(tipo: string | null | undefined): PromoCanal {
  if (tipo === 'delivery') return 'delivery';
  if (tipo === 'takeaway') return 'takeaway';
  if (tipo === 'mostrador') return 'mostrador';
  return 'salon';
}

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

/**
 * Resumen corto y legible de las condiciones de una promo (método de pago, días,
 * franja horaria, monto mínimo). Devuelve '' si no tiene condiciones; cada caller
 * decide el texto por defecto. Lo usan la tabla del admin y la vista del comensal.
 */
export function promoCondicionResumen(p: Promocion): string {
  const c = p.condiciones || {};
  const partes: string[] = [];
  if (c.soloEfectivo || (c.metodosPago?.length === 1 && c.metodosPago[0] === 'efectivo')) {
    partes.push('Pago en efectivo');
  } else if (c.metodosPago?.length) {
    partes.push(c.metodosPago.map((m) => (m === 'mercado_pago' ? 'MP' : m)).join('/'));
  }
  if (c.dias?.length) {
    partes.push(c.dias.map((d) => PROMO_DIAS.find((x) => x.value === d)?.label ?? d).join(''));
  }
  if (c.horaDesde && c.horaHasta) partes.push(`${c.horaDesde}–${c.horaHasta}`);
  if (c.montoMinimo) partes.push(`mín. $${c.montoMinimo}`);
  return partes.join(' · ');
}

/**
 * Promos que tiene sentido mostrarle al comensal en una superficie dada: activas,
 * dentro de su rango de fechas y cuyo canal (si lo restringe) incluya alguno de
 * los canales de la superficie. NO filtra por método de pago / día / hora: esas
 * condiciones se muestran como texto (ver `promoCondicionResumen`) para que el
 * comensal sepa cómo acceder al beneficio. El descuento real lo decide el motor.
 */
export function promosVisibles(
  promos: Promocion[],
  canales: PromoCanal[],
  now: Date = new Date(),
): Promocion[] {
  return promos.filter((p) => {
    if (!p.activa) return false;
    if (p.vigenteDesde && now < new Date(p.vigenteDesde)) return false;
    if (p.vigenteHasta && now > new Date(p.vigenteHasta)) return false;
    const restric = p.condiciones?.canales;
    if (restric?.length && !restric.some((c) => canales.includes(c))) return false;
    return true;
  });
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
