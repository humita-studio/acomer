'use client';

import { useState } from 'react';
import { Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatPeso } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import type { CategoriaMenu, ProductoMenu } from '@/features/carta/types';
import { filtrarProductosPorBusqueda } from '@/features/carta/buscarProductos';
import {
  colorCategoriaMeta,
  ICONOS_CATEGORIA_MAP,
  resolveIconoCategoria,
} from '@/features/menu/categoriaVisual';
import type { CartLine } from '../types';
import { QtyStepper } from './QtyStepper';
import { ProductoConfigDialog } from './ProductoConfigDialog';
import { ItemLibreDialog } from './ItemLibreDialog';

/** Paso 1 — armar el pedido: catálogo (buscar + categorías) + la cuenta. */
export function PasoArmar({
  menu,
  cart,
  total,
  nombreRef,
  setNombreRef,
  onAgregar,
  onAgregarLibre,
  onCambiarCantidad,
  onQuitar,
  onCobrar,
  onCancelar,
}: {
  menu: { categorias: CategoriaMenu[]; productos: ProductoMenu[] } | undefined;
  cart: CartLine[];
  total: number;
  nombreRef: string;
  setNombreRef: (v: string) => void;
  onAgregar: (p: ProductoMenu, modIds: string[], cantidad: number, varianteId: string | null) => void;
  onAgregarLibre: (nombre: string, precio: number, cantidad: number) => void;
  onCambiarCantidad: (key: string, delta: number) => void;
  onQuitar: (key: string) => void;
  onCobrar: () => void;
  onCancelar: () => void;
}) {
  const categorias = menu?.categorias ?? [];
  const productos = menu?.productos ?? [];
  const [catActivaSel, setCatActiva] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [libreOpen, setLibreOpen] = useState(false);
  const [prodConfig, setProdConfig] = useState<ProductoMenu | null>(null);

  // Con variantes o adicionales: abrir el selector. Sin nada: sumar directo.
  const handleProductoClick = (p: ProductoMenu) => {
    if (p.variantes.length > 0 || (p.modificadores.length > 0)) {
      setProdConfig(p);
    } else {
      onAgregar(p, [], 1, null);
    }
  };

  // Categoría activa: la elegida por el usuario o, por defecto, la primera.
  // Derivado en render (sin effect) para no disparar renders en cascada.
  const catActiva = catActivaSel || categorias[0]?.id || '';

  const q = busqueda.trim();
  const visibles = q
    ? filtrarProductosPorBusqueda(productos, q)
    : productos.filter((p) => p.categoriaId === catActiva);

  return (
    <div className="flex max-h-[85vh] flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 border-b p-5">
        <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          <ShoppingCart className="size-3.5" />
          Mostrador
        </span>
        <div className="space-y-0.5">
          <DialogTitle className="font-display text-xl tracking-tight">Venta de mostrador</DialogTitle>
          <DialogDescription>Pedido nuevo · sin mesa</DialogDescription>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Cuenta */}
        <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div className="space-y-3 p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pedido</p>
            <Input
              value={nombreRef}
              onChange={(e) => setNombreRef(e.target.value)}
              placeholder="Nombre o referencia (opcional)"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sumá productos del menú o un ítem libre.
              </p>
            ) : (
              cart.map((l) => (
                <div key={l.key} className="group flex items-center gap-2 py-1.5 text-sm">
                  <QtyStepper
                    size="sm"
                    value={l.cantidad}
                    onMinus={() => onCambiarCantidad(l.key, -1)}
                    onPlus={() => onCambiarCantidad(l.key, 1)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">{l.nombre}</span>
                    {l.modificadoresNombres.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {l.modificadoresNombres.join(', ')}
                      </span>
                    )}
                  </div>
                  <span className="font-medium tabular-nums">{formatPeso(l.precioUnitario * l.cantidad)}</span>
                  <button
                    type="button"
                    onClick={() => onQuitar(l.key)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="Quitar"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 border-t p-5">
            <Button variant="outline" className="w-full border-dashed" onClick={() => setLibreOpen(true)}>
              <Plus />
              Agregar ítem libre
            </Button>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-semibold tabular-nums">{formatPeso(total)}</span>
            </div>
            <Button size="lg" className="w-full" disabled={cart.length === 0} onClick={onCobrar}>
              Cobrar · {formatPeso(total)}
            </Button>
            <button
              type="button"
              onClick={onCancelar}
              className="w-full text-center text-sm font-medium text-destructive hover:underline"
            >
              Cancelar venta
            </button>
          </div>
        </aside>

        {/* Selector de productos */}
        <section className="flex min-h-0 flex-col p-5">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="pl-9"
            />
          </div>

          {!q && categorias.length > 0 && (
            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
              {categorias.map((c) => {
                const activa = catActiva === c.id;
                const meta = colorCategoriaMeta(c.color);
                const Icon = ICONOS_CATEGORIA_MAP[resolveIconoCategoria(c.icono)];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatActiva(c.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                      !activa && 'hover:opacity-90',
                    )}
                    style={
                      activa
                        ? { backgroundColor: meta.hex, color: '#fff' }
                        : { backgroundColor: meta.soft, color: meta.hex }
                    }
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {c.nombre}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {visibles.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {productos.length === 0 ? 'No hay productos en el menú.' : 'Sin resultados.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibles.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="space-y-0.5">
                      <h3 className="font-medium leading-tight">{p.nombre}</h3>
                      {p.descripcion && (
                        <p className="truncate text-xs text-muted-foreground">{p.descripcion}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold tabular-nums">
                        {p.variantes.length > 0 && <span className="font-normal text-muted-foreground">desde </span>}
                        {formatPeso(p.precio)}
                      </span>
                      <Button size="icon-sm" onClick={() => handleProductoClick(p)} aria-label={`Agregar ${p.nombre}`}>
                        <Plus />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {prodConfig && (
        <ProductoConfigDialog
          producto={prodConfig}
          onClose={() => setProdConfig(null)}
          onAgregar={(modIds, cantidad, varianteId) => {
            onAgregar(prodConfig, modIds, cantidad, varianteId);
            setProdConfig(null);
          }}
        />
      )}

      {libreOpen && (
        <ItemLibreDialog
          onClose={() => setLibreOpen(false)}
          onAgregar={(nombre, precio, cantidad) => {
            onAgregarLibre(nombre, precio, cantidad);
            setLibreOpen(false);
          }}
        />
      )}
    </div>
  );
}
