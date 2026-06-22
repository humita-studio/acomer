// Metadatos de presentación de cada método de pago presencial.
// Centralizado para que la card del cobro y el modal de aprobación
// compartan etiqueta, icono y color (tokens del DS cálido).

import { Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react';

export type MetodoId = 'efectivo' | 'tarjeta_fisica' | 'mercado_pago';

type MetodoInfo = {
  label: string;
  Icon: LucideIcon;
  /** Clases del recuadro del icono (fondo + color). */
  iconBox: string;
};

export const METODOS: Record<MetodoId, MetodoInfo> = {
  efectivo: {
    label: 'Efectivo',
    Icon: Banknote,
    iconBox: 'bg-success-subtle text-success-foreground',
  },
  tarjeta_fisica: {
    label: 'Tarjeta física',
    Icon: CreditCard,
    iconBox: 'bg-accent text-primary',
  },
  mercado_pago: {
    label: 'Mercado Pago',
    Icon: Wallet,
    iconBox: 'bg-warning-subtle text-warning-foreground',
  },
};

/** Devuelve la info del método, con fallback a efectivo para valores desconocidos. */
export function metodoInfo(proveedor: string): MetodoInfo {
  return METODOS[proveedor as MetodoId] ?? METODOS.efectivo;
}

/** Indica si el cobro es en efectivo (habilita la calculadora de vuelto). */
export function esEfectivo(proveedor: string): boolean {
  return proveedor === 'efectivo';
}
