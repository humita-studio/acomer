'use client';

import { useState } from 'react';
import { CheckCircle2, Minus, Plus, ShoppingCart, Tag } from 'lucide-react';
import {
  getCartTotal,
  type CartApi,
  type CartPromoResumen,
  type PedidoConfirmadoResumen,
} from '../cart';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';

type FloatingCartProps = {
  cart: CartApi;
  pedidosConfirmados?: PedidoConfirmadoResumen[];
  /** Texto del botón de confirmación (ej: "Confirmar Pedido" | "Finalizar pedido"). */
  confirmLabel: string;
  /** Acción al confirmar. Devolver { success:false } muestra el error y deja el cart abierto. */
  onConfirm: () => Promise<{ success: boolean; message?: string } | void>;
  confirming: boolean;
  /** Título del drawer (ej: "Resumen de tu Mesa" | "Tu pedido"). */
  titulo?: string;
  /** Descuento por promos sobre el borrador (preview server-side). Opcional. */
  promoResumen?: CartPromoResumen | null;
};

export function FloatingCart({
  cart,
  pedidosConfirmados = [],
  confirmLabel,
  onConfirm,
  confirming,
  titulo = 'Resumen de tu Mesa',
  promoResumen = null,
}: FloatingCartProps) {
  const items = cart.items;
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consideramo si el carrito está vacío y no hay pedidos confirmados
  if (items.length === 0 && pedidosConfirmados.length === 0) return null;

  const totalBorrador = getCartTotal(items);
  const totalItemsBorrador = items.reduce((sum, item) => sum + item.cantidad, 0);

  const totalConfirmado = pedidosConfirmados.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItemsConfirmado = pedidosConfirmados.reduce((sum, item) => sum + item.cantidad, 0);

  // Descuento aplicable al borrador (sólo si el preview lo trae). El total mostrado
  // se mantiene consistente con las líneas locales: total = borrador − descuento.
  const descuento = promoResumen && promoResumen.descuento > 0 ? promoResumen.descuento : 0;
  const promosAplicadas = descuento > 0 ? promoResumen?.aplicadas ?? [] : [];
  const totalBorradorNeto = Math.max(0, totalBorrador - descuento);

  const granTotal = totalBorradorNeto + totalConfirmado;
  const totalItemsGeneral = totalItemsBorrador + totalItemsConfirmado;

  const handleRemoveItem = (itemId: string) => {
    cart.eliminar(itemId);
  };

  const handleUpdateQuantity = (itemId: string, currentQuantity: number, delta: number) => {
    const nuevaCantidad = Math.max(1, currentQuantity + delta);
    cart.actualizar(itemId, nuevaCantidad);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      const res = await onConfirm();
      if (!res || res.success) {
        setIsOpen(false);
      } else {
        setError(res.message ?? 'Error al enviar');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    }
  };

  return (
    <>
      {/* Botón flotante siempre visible cuando hay items pero el cart está cerrado */}
      {!isOpen && (items.length > 0 || pedidosConfirmados.length > 0) && (
        <div className="fixed inset-x-0 bottom-6 z-40 px-4 duration-300 animate-in fade-in slide-in-from-bottom-10">
          <div className="mx-auto max-w-2xl">
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="h-14 w-full justify-between rounded-2xl px-6 text-base shadow-lg"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-sm tabular-nums">
                  {totalItemsGeneral}
                </span>
                Ver Pedido
              </span>
              <span className="text-lg tabular-nums">${granTotal.toFixed(2)}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl sm:rounded-t-2xl"
        >
          <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b p-4">
            <SheetTitle className="text-xl">{titulo}</SheetTitle>
            <Badge variant="secondary" className="rounded-full">
              {totalItemsGeneral} items
            </Badge>
          </SheetHeader>

          {/* Cart Items */}
          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {/* Pedidos Confirmados */}
            {pedidosConfirmados.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 border-b pb-2 font-semibold text-green-600 dark:text-green-500">
                  <CheckCircle2 className="size-4" />
                  En preparación
                </h3>
                <div className="space-y-3 opacity-80">
                  {pedidosConfirmados.map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b border-border/60 pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{item.cantidad}x {item.nombre}</h4>
                          {item.modificadores.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              + {item.modificadores.map((m) => m.nombre).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums">${item.subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Borrador / Nuevos Items */}
            {items.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 border-b pb-2 font-semibold">
                  <ShoppingCart className="size-4" />
                  Por confirmar
                </h3>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex flex-col border-b pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{item.nombre}</h4>
                          {item.modificadores.length > 0 && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              + {item.modificadores.map(m => m.nombre).join(', ')}
                            </p>
                          )}
                          <p className="mt-1 font-medium tabular-nums">
                            ${((item.precioUnitario + item.modificadores.reduce((s,m)=>s+m.precioExtra,0)) * item.cantidad).toFixed(2)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 rounded-full border bg-muted/50 p-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full"
                            onClick={() => handleUpdateQuantity(item.id, item.cantidad, -1)}
                            aria-label="Quitar uno"
                          >
                            <Minus />
                          </Button>
                          <span className="w-4 text-center font-medium tabular-nums">{item.cantidad}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full"
                            onClick={() => handleUpdateQuantity(item.id, item.cantidad, 1)}
                            aria-label="Agregar uno"
                          >
                            <Plus />
                          </Button>
                        </div>
                      </div>

                      <Button
                        variant="link"
                        size="xs"
                        className="mt-2 h-auto self-start p-0 text-destructive"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t bg-muted/40 p-4">
              {error && (
                <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              {/* Promos aplicadas automáticamente al borrador (preview). */}
              {promosAplicadas.length > 0 && (
                <div className="mb-3 space-y-2">
                  {promosAplicadas.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-success-subtle px-3 py-2 text-success-foreground"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Tag className="size-4 shrink-0" />
                        <span className="truncate text-sm font-medium">{p.nombre}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        −${p.descuento.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {descuento > 0 ? (
                <div className="mb-4 space-y-1">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">${totalBorrador.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-success-foreground">
                    <span>Descuento</span>
                    <span className="tabular-nums">−${descuento.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-1.5 text-lg font-bold">
                    <span>A enviar ahora</span>
                    <span className="tabular-nums">${totalBorradorNeto.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between text-lg font-bold">
                  <span>A enviar ahora</span>
                  <span className="tabular-nums">${totalBorrador.toFixed(2)}</span>
                </div>
              )}
              <Button
                onClick={handleSubmit}
                disabled={confirming}
                size="lg"
                className="h-12 w-full text-base"
              >
                {confirming ? 'Enviando...' : confirmLabel}
              </Button>
            </div>
          )}

          {items.length === 0 && pedidosConfirmados.length > 0 && (
            <div className="border-t bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              Todo tu pedido ya fue enviado a cocina.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
