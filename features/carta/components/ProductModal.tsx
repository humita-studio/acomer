'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Modificador, CartApi } from '../cart';
import type { ProductoMenu } from '../types';
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

  const tieneVariantes = product.variantes.length > 0;
  // Variante preseleccionada: la marcada por defecto o la primera.
  const [varianteId, setVarianteId] = useState<string | null>(
    tieneVariantes ? (product.variantes.find((v) => v.esDefault) ?? product.variantes[0]).id : null
  );
  const variante = tieneVariantes
    ? product.variantes.find((v) => v.id === varianteId) ?? null
    : null;

  const toggleModificador = (mod: Modificador) => {
    const exists = selectedMods.find((m) => m.id === mod.id);
    if (exists) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, mod]);
    }
  };

  // Precio unitario: el de la variante elegida (absoluto) o el base del producto.
  const precioUnitario = variante ? variante.precio : product.precio;
  const modsTotal = selectedMods.reduce((sum, mod) => sum + mod.precioExtra, 0);
  const subtotal = (precioUnitario + modsTotal) * cantidad;

  const handleAddToCart = () => {
    // El driver aplica el update optimista al instante (y revierte solo si el
    // server falla). Cerramos el modal YA, sin esperar el roundtrip: el item
    // aparece en el carrito al toque. Bloquear el cierre hacía sentir lento al
    // flujo de mesa aunque la caché ya estuviera actualizada.
    cart
      .agregar({
        productoId: product.id,
        varianteId: variante?.id ?? null,
        nombreProducto: variante ? `${product.nombre} ${variante.nombre}` : product.nombre,
        precioUnitario,
        cantidad,
        modificadores: selectedMods,
      })
      .catch(() => {
        // El driver ya revirtió el optimismo; no hay nada que hacer al cerrar.
      });
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

          {/* Variantes: elección única y obligatoria (precio fijo por opción) */}
          {tieneVariantes ? (
            <div className="space-y-3">
              <h3 className="border-b pb-2 text-lg font-semibold">Elegí una opción</h3>
              {product.variantes.map((v) => {
                const isSelected = varianteId === v.id;
                return (
                  <label
                    key={v.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variante"
                        className="size-5 accent-primary"
                        checked={isSelected}
                        onChange={() => setVarianteId(v.id)}
                      />
                      <span className="font-medium">{v.nombre}</span>
                    </div>
                    <span className="tabular-nums text-muted-foreground">${v.precio.toFixed(2)}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-lg font-medium">
              Precio: ${product.precio.toFixed(2)}
            </div>
          )}

          {/* Adicionales (extras opcionales, se suman) */}
          {product.modificadores.length > 0 && (
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
            size="lg"
            className="h-12 w-full justify-between text-base"
          >
            <span>Agregar al Pedido</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
