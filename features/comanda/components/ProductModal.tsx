'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { type Modificador } from '../store';
import type { CartApi } from '../cart/use-cart';
import { ProductoMenu } from './MenuDigital';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

type ProductModalProps = {
  product: ProductoMenu;
  cart: CartApi;
  onClose: () => void;
};

export function ProductModal({ product, cart, onClose }: ProductModalProps) {
  const [cantidad, setCantidad] = useState(1);
  const [selectedMods, setSelectedMods] = useState<Modificador[]>([]);

  const toggleModificador = (mod: Modificador) => {
    const exists = selectedMods.find((m) => m.id === mod.id);
    if (exists) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, mod]);
    }
  };

  const modsTotal = selectedMods.reduce((sum, mod) => sum + mod.precioExtra, 0);
  const subtotal = (product.precio + modsTotal) * cantidad;

  const handleAddToCart = async () => {
    // El driver aplica el update optimista al instante; esperamos a que resuelva
    // (en server reconcilia y avisa a otros dispositivos) antes de cerrar.
    try {
      await cart.agregar({
        productoId: product.id,
        nombreProducto: product.nombre,
        precioUnitario: product.precio,
        cantidad,
        modificadores: selectedMods,
      });
    } catch {
      // Si falla, el driver ya revirtió el optimismo; cerramos igual.
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b p-4 text-left">
          <DialogTitle className="text-xl">{product.nombre}</DialogTitle>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {product.descripcion && (
            <p className="text-muted-foreground">{product.descripcion}</p>
          )}

          <div className="text-lg font-medium">
            Precio base: ${product.precio.toFixed(2)}
          </div>

          {/* Modificadores */}
          {product.permiteAdicionales && product.modificadores.length > 0 && (
            <div className="space-y-3">
              <h3 className="border-b pb-2 text-lg font-semibold">Adicionales</h3>
              {product.modificadores.map((mod) => {
                const isSelected = selectedMods.some((m) => m.id === mod.id);
                return (
                  <label
                    key={mod.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-5 rounded accent-primary"
                        checked={isSelected}
                        onChange={() => toggleModificador(mod)}
                      />
                      <span className="font-medium">{mod.nombre}</span>
                    </div>
                    {mod.precioExtra > 0 && (
                      <span className="text-muted-foreground">+${mod.precioExtra.toFixed(2)}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {/* Selector de cantidad */}
          <div className="flex items-center justify-center gap-6 py-2">
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-full"
              onClick={() => setCantidad(Math.max(1, cantidad - 1))}
              aria-label="Quitar uno"
            >
              <Minus />
            </Button>
            <span className="w-8 text-center text-2xl font-bold tabular-nums">{cantidad}</span>
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-full"
              onClick={() => setCantidad(cantidad + 1)}
              aria-label="Agregar uno"
            >
              <Plus />
            </Button>
          </div>
        </div>

        {/* Footer / Agregar */}
        <div className="border-t bg-muted/40 p-4">
          <Button
            onClick={handleAddToCart}
            disabled={cart.agregando}
            size="lg"
            className="h-12 w-full justify-between text-base"
          >
            <span>{cart.agregando ? 'Agregando...' : 'Agregar al Pedido'}</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
