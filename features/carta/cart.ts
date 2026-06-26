// Modelo y contrato del carrito, agnóstico al driver. Los componentes de carta
// (MenuView / ProductModal / FloatingCart) consumen un `CartApi`; cada superficie
// provee su driver: `useServerCart` (borrador por sesión, en comanda) o
// `useLocalCart` (localStorage, flujo "menú primero").

export type Modificador = {
  id: string;
  nombre: string;
  precioExtra: number;
};

export type CartItem = {
  id: string;
  productoId: string;
  /** Variante elegida (presentación). Null/undefined si el producto no tiene variantes. */
  varianteId?: string | null;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  modificadores: Modificador[];
};

/** Total del carrito: (precio base + adicionales) * cantidad, por item. */
export function getCartTotal(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const modsTotal = item.modificadores.reduce((sum, mod) => sum + mod.precioExtra, 0);
    return total + (item.precioUnitario + modsTotal) * item.cantidad;
  }, 0);
}

export type AgregarItemVars = {
  productoId: string;
  /** Variante elegida (presentación). Null/undefined si el producto no tiene variantes. */
  varianteId?: string | null;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
  modificadores: Modificador[];
};

export type CartApi = {
  items: CartItem[];
  agregar: (vars: AgregarItemVars) => Promise<void>;
  agregando: boolean;
  eliminar: (itemId: string) => void;
  actualizar: (itemId: string, nuevaCantidad: number) => void;
};

/** Resumen de un ítem ya confirmado (enviado a cocina) para mostrar en el carrito. */
export type PedidoConfirmadoResumen = {
  cantidad: number;
  nombre: string;
  subtotal: number;
  modificadores: { nombre: string }[];
};

// Promos de cara al comensal. Tipos PLANOS a propósito: carta es un cimiento y no
// importa la feature de promociones; las superficies (mesa/online) calculan estos
// datos y los inyectan. Estructuralmente compatibles con los tipos de promociones.

/** Resultado del descuento aplicado al carrito (subtotal/descuento/total). */
export type CartPromoResumen = {
  subtotal: number;
  descuento: number;
  total: number;
  aplicadas: { id: string; nombre: string; descuento: number }[];
};

/** Una promo disponible para listar en el menú (informativa). */
export type CartPromoDisponible = {
  id: string;
  nombre: string;
  /** Etiqueta corta del beneficio: "−10%", "2x1", etc. */
  badge: string;
  /** Condición legible ("Pago en efectivo · LMV"), si tiene. */
  condicion?: string;
};
