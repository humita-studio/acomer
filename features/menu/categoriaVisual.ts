// Paleta de colores e iconos permitidos para categorías del menú.
// Se persisten como strings en DB; este módulo es la fuente de verdad del
// frontend (validación, labels y clases/estilos de presentación).

import {
  Beer,
  Cake,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Fish,
  GlassWater,
  IceCream,
  Leaf,
  Martini,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------

export const COLORES_CATEGORIA = [
  'terracota',
  'naranja',
  'ambar',
  'lima',
  'verde',
  'teal',
  'azul',
  'indigo',
  'morado',
  'rosa',
  'rojo',
  'gris',
] as const;

export type ColorCategoria = (typeof COLORES_CATEGORIA)[number];

export const COLOR_CATEGORIA_DEFAULT: ColorCategoria = 'terracota';

type ColorMeta = {
  label: string;
  /** Hex sólido para chips activos y acentos. */
  hex: string;
  /** Fondo suave (con alpha) para chips inactivos / rail. */
  soft: string;
};

export const COLORES_CATEGORIA_META: Record<ColorCategoria, ColorMeta> = {
  terracota: { label: 'Terracota', hex: '#c2562f', soft: 'rgba(194, 86, 47, 0.14)' },
  naranja: { label: 'Naranja', hex: '#e07a2f', soft: 'rgba(224, 122, 47, 0.14)' },
  ambar: { label: 'Ámbar', hex: '#d4a017', soft: 'rgba(212, 160, 23, 0.16)' },
  lima: { label: 'Lima', hex: '#7cb342', soft: 'rgba(124, 179, 66, 0.16)' },
  verde: { label: 'Verde', hex: '#2f7e49', soft: 'rgba(47, 126, 73, 0.14)' },
  teal: { label: 'Teal', hex: '#0d9488', soft: 'rgba(13, 148, 136, 0.14)' },
  azul: { label: 'Azul', hex: '#3b82f6', soft: 'rgba(59, 130, 246, 0.14)' },
  indigo: { label: 'Índigo', hex: '#6366f1', soft: 'rgba(99, 102, 241, 0.14)' },
  morado: { label: 'Morado', hex: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.14)' },
  rosa: { label: 'Rosa', hex: '#ec4899', soft: 'rgba(236, 72, 153, 0.14)' },
  rojo: { label: 'Rojo', hex: '#dc2626', soft: 'rgba(220, 38, 38, 0.12)' },
  gris: { label: 'Gris', hex: '#6b7280', soft: 'rgba(107, 114, 128, 0.14)' },
};

export function isColorCategoria(value: string): value is ColorCategoria {
  return (COLORES_CATEGORIA as readonly string[]).includes(value);
}

export function colorCategoriaMeta(color: string | null | undefined): ColorMeta {
  if (color && isColorCategoria(color)) return COLORES_CATEGORIA_META[color];
  return COLORES_CATEGORIA_META[COLOR_CATEGORIA_DEFAULT];
}

// ---------------------------------------------------------------------------
// Iconos
// ---------------------------------------------------------------------------

export const ICONOS_CATEGORIA = [
  'utensils',
  'utensils-crossed',
  'coffee',
  'cup-soda',
  'wine',
  'beer',
  'martini',
  'glass-water',
  'pizza',
  'salad',
  'soup',
  'sandwich',
  'croissant',
  'drumstick',
  'fish',
  'leaf',
  'ice-cream',
  'cake',
  'cookie',
] as const;

export type IconoCategoria = (typeof ICONOS_CATEGORIA)[number];

export const ICONO_CATEGORIA_DEFAULT: IconoCategoria = 'utensils';

export const ICONOS_CATEGORIA_MAP: Record<IconoCategoria, LucideIcon> = {
  utensils: Utensils,
  'utensils-crossed': UtensilsCrossed,
  coffee: Coffee,
  'cup-soda': CupSoda,
  wine: Wine,
  beer: Beer,
  martini: Martini,
  'glass-water': GlassWater,
  pizza: Pizza,
  salad: Salad,
  soup: Soup,
  sandwich: Sandwich,
  croissant: Croissant,
  drumstick: Drumstick,
  fish: Fish,
  leaf: Leaf,
  'ice-cream': IceCream,
  cake: Cake,
  cookie: Cookie,
};

export function isIconoCategoria(value: string): value is IconoCategoria {
  return (ICONOS_CATEGORIA as readonly string[]).includes(value);
}

/** Clave de icono válida (fallback a utensils). Usar con `ICONOS_CATEGORIA_MAP`. */
export function resolveIconoCategoria(icono: string | null | undefined): IconoCategoria {
  return icono && isIconoCategoria(icono) ? icono : ICONO_CATEGORIA_DEFAULT;
}

/** Normaliza color/icono entrantes (formulario o DB) a valores válidos. */
export function normalizarVisualCategoria(input: {
  color?: string | null;
  icono?: string | null;
}): { color: ColorCategoria; icono: IconoCategoria } {
  return {
    color: input.color && isColorCategoria(input.color) ? input.color : COLOR_CATEGORIA_DEFAULT,
    icono: input.icono && isIconoCategoria(input.icono) ? input.icono : ICONO_CATEGORIA_DEFAULT,
  };
}
