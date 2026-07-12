'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Minus, Plus } from 'lucide-react';
import { liberarMesaAction } from '@/features/mesas/mesas-actions';
import { useTicketMesa, useAgregarItemsStaff } from '@/features/comanda/use-ticket-mesa';
import { queryKeys } from '@/shared/query/keys';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ProductoMenu, CategoriaMenu, ModificadorMenu } from '@/features/carta/types';
import {
  colorCategoriaMeta,
  ICONOS_CATEGORIA_MAP,
  resolveIconoCategoria,
} from '@/features/menu/categoriaVisual';
import type { TicketItem } from '@/features/pedidos/obtenerTicketMesa';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { TicketPrintButton } from '@/features/pagos/components/TicketPrintButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

type Props = {
  mesaId: string;
  sesionMesaId: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
  ticketInicial: { items: TicketItem[]; total: number };
  canLiberar?: boolean;
};

export function MesaPedidoManager({
  mesaId,
  sesionMesaId,
  categorias,
  productos,
  ticketInicial,
  canLiberar = true,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>(categorias[0]?.id || '');
  const [selectedProduct, setSelectedProduct] = useState<ProductoMenu | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [selectedModIds, setSelectedModIds] = useState<string[]>([]);
  const [selectedVarianteId, setSelectedVarianteId] = useState<string | null>(null);
  const [notaCocina, setNotaCocina] = useState('');
  const [isLiberating, setIsLiberating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [freeOpen, setFreeOpen] = useState(false);
  const [freeNombre, setFreeNombre] = useState('');
  const [freePrecio, setFreePrecio] = useState('');
  const [freeCantidad, setFreeCantidad] = useState(1);
  const [freeError, setFreeError] = useState<string | null>(null);

  const { data: ticket = { items: [], total: 0 } } = useTicketMesa(sesionMesaId, ticketInicial);
  const agregar = useAgregarItemsStaff(sesionMesaId);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`mesa_${sesionMesaId}`);
    channel
      .on('broadcast', { event: 'ticket_actualizado' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketMesa(sesionMesaId) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sesionMesaId, queryClient]);

  const activeProducts = productos.filter((p) => p.categoriaId === activeCategory);

  const openProduct = (prod: ProductoMenu) => {
    setSelectedProduct(prod);
    setCantidad(1);
    setSelectedModIds([]);
    setSelectedVarianteId(
      prod.variantes.length > 0
        ? (prod.variantes.find((v) => v.esDefault) ?? prod.variantes[0]).id
        : null,
    );
    setNotaCocina('');
    setError(null);
  };

  const toggleMod = (mod: ModificadorMenu) => {
    setSelectedModIds((prev) =>
      prev.includes(mod.id) ? prev.filter((id) => id !== mod.id) : [...prev, mod.id],
    );
  };

  const varianteSel = selectedProduct?.variantes.find((v) => v.id === selectedVarianteId) ?? null;
  const precioBaseModal = varianteSel ? varianteSel.precio : selectedProduct?.precio ?? 0;
  const modsTotal = selectedProduct
    ? selectedProduct.modificadores
        .filter((m) => selectedModIds.includes(m.id))
        .reduce((sum, m) => sum + m.precioExtra, 0)
    : 0;
  const subtotalModal = selectedProduct ? (precioBaseModal + modsTotal) * cantidad : 0;

  const handleAgregar = () => {
    if (!selectedProduct) return;
    const modsSeleccionados = selectedProduct.modificadores.filter((m) =>
      selectedModIds.includes(m.id),
    );
    const precioBase = varianteSel ? varianteSel.precio : selectedProduct.precio;
    const precioConMods = precioBase + modsSeleccionados.reduce((s, m) => s + m.precioExtra, 0);
    const nota = notaCocina.trim();
    const nombreItem = varianteSel
      ? `${selectedProduct.nombre} ${varianteSel.nombre}`
      : selectedProduct.nombre;
    const optimisticItem: TicketItem = {
      id: `temp-${crypto.randomUUID()}`,
      nombre: nota ? `${nombreItem} · ${nota}` : nombreItem,
      cantidad,
      precioUnitario: precioBase,
      modificadores: modsSeleccionados.map((m) => ({ nombre: m.nombre, precioExtra: m.precioExtra })),
      subtotal: precioConMods * cantidad,
    };
    agregar.mutate({
      items: [
        {
          productoId: selectedProduct.id,
          varianteId: varianteSel?.id ?? null,
          cantidad,
          modificadorIds: selectedModIds,
        },
      ],
      optimisticItems: [optimisticItem],
      notas: nota || null,
    });
    setSelectedProduct(null);
  };

  const openFree = () => {
    setFreeNombre('');
    setFreePrecio('');
    setFreeCantidad(1);
    setFreeError(null);
    setFreeOpen(true);
  };

  const handleAgregarLibre = () => {
    const nombre = freeNombre.trim();
    const precio = parseFloat(freePrecio.replace(',', '.'));
    if (!nombre) {
      setFreeError('Poné un nombre');
      return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      setFreeError('El precio tiene que ser mayor a 0');
      return;
    }
    const optimisticItem: TicketItem = {
      id: `temp-${crypto.randomUUID()}`,
      nombre,
      cantidad: freeCantidad,
      precioUnitario: precio,
      modificadores: [],
      subtotal: precio * freeCantidad,
    };
    agregar.mutate({
      items: [{ productoId: null, cantidad: freeCantidad, nombreLibre: nombre, precioLibre: precio }],
      optimisticItems: [optimisticItem],
    });
    setFreeOpen(false);
  };

  const freeSubtotal = (parseFloat(freePrecio.replace(',', '.')) || 0) * freeCantidad;

  const handleLiberar = async () => {
    if (!confirm('¿Liberar la mesa? Se cerrará la sesión actual.')) return;
    setIsLiberating(true);
    setError(null);
    const res = await liberarMesaAction(mesaId);
    setIsLiberating(false);
    if (res.success) {
      router.push('/admin/mesas');
      router.refresh();
    } else {
      setError(res.message || 'No se pudo liberar la mesa');
    }
  };

  const categoriaActivaNombre =
    categorias.find((c) => c.id === activeCategory)?.nombre ?? 'Menú';

  return (
    <div className="space-y-4">
      {canLiberar && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="border-primary/25 text-primary hover:bg-accent"
            onClick={handleLiberar}
            disabled={isLiberating}
          >
            <DoorOpen />
            {isLiberating ? 'Liberando…' : 'Liberar mesa'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        {/* Cuenta de la mesa */}
        <Card className="h-fit shadow-sm lg:sticky lg:top-20">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Cuenta de la mesa</CardTitle>
            {ticket.items.length > 0 && (
              <TicketPrintButton
                size="sm"
                variant="outline"
                label="Imprimir"
                ticket={{
                  titulo: 'Ticket de mesa',
                  subtitulo: `Sesión ${sesionMesaId.slice(0, 8)}…`,
                  lineas: ticket.items.map((item) => ({
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    subtotal: item.subtotal,
                  })),
                  total: ticket.total,
                }}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {ticket.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todavía no hay pedidos en esta mesa.
              </p>
            ) : (
              <div className="space-y-3">
                {ticket.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {item.cantidad}× {item.nombre}
                      </p>
                      {item.modificadores.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          + {item.modificadores.map((m) => m.nombre).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {formatPeso(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="font-display text-xl font-semibold tabular-nums tracking-tight">
                {formatPeso(ticket.total)}
              </span>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agregar al pedido */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Agregar al pedido</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={openFree}>
              + Ítem libre
            </Button>
          </CardHeader>
          <CardContent>
            {categorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay productos cargados en el menú.</p>
            ) : (
              <>
                <div className="mb-4 overflow-x-auto pb-1">
                  <div className="flex gap-2">
                    {categorias.map((cat) => {
                      const activa = activeCategory === cat.id;
                      const meta = colorCategoriaMeta(cat.color);
                      const Icon = ICONOS_CATEGORIA_MAP[resolveIconoCategoria(cat.icono)];
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveCategory(cat.id)}
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                            !activa && 'hover:opacity-90',
                          )}
                          style={
                            activa
                              ? { backgroundColor: meta.hex, color: '#fff' }
                              : { backgroundColor: meta.soft, color: meta.hex }
                          }
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {cat.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeProducts.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      No hay productos en esta categoría.
                    </p>
                  ) : (
                    activeProducts.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => openProduct(prod)}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/35 hover:bg-accent/40"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-foreground">{prod.nombre}</h3>
                          <p className="mt-1 text-sm font-semibold text-primary">
                            {prod.variantes.length > 0 && (
                              <span className="font-normal text-muted-foreground">desde </span>
                            )}
                            {formatPeso(prod.precio)}
                          </p>
                        </div>
                        <span className="ml-3 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                          <Plus className="size-4" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal agregar producto — Figma Mesa detalle · Estados de acción */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]">
          {selectedProduct && (
            <>
              <DialogHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
                <DialogTitle className="font-display text-xl font-semibold tracking-tight">
                  {selectedProduct.nombre}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {categoriaActivaNombre} · {formatPeso(precioBaseModal)}
                </p>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">Cantidad</span>
                  <div className="flex items-center overflow-hidden rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                      className="flex size-10 items-center justify-center hover:bg-muted"
                      aria-label="Menos"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">{cantidad}</span>
                    <button
                      type="button"
                      onClick={() => setCantidad(cantidad + 1)}
                      className="flex size-10 items-center justify-center hover:bg-muted"
                      aria-label="Más"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>

                {selectedProduct.variantes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Opciones
                    </p>
                    {selectedProduct.variantes.map((v) => (
                      <label
                        key={v.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="variante-staff"
                            className="size-4 accent-[var(--primary)]"
                            checked={selectedVarianteId === v.id}
                            onChange={() => setSelectedVarianteId(v.id)}
                          />
                          <span className="text-sm font-medium">{v.nombre}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatPeso(v.precio)}</span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedProduct.modificadores.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Agregar
                    </p>
                    {selectedProduct.modificadores.map((mod) => (
                      <label
                        key={mod.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="size-4 rounded accent-[var(--primary)]"
                            checked={selectedModIds.includes(mod.id)}
                            onChange={() => toggleMod(mod)}
                          />
                          <span className="text-sm font-medium">{mod.nombre}</span>
                        </div>
                        {mod.precioExtra > 0 && (
                          <span className="shrink-0 text-sm text-muted-foreground">
                            + {formatPeso(mod.precioExtra)}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Nota para cocina
                  </p>
                  <Textarea
                    value={notaCocina}
                    onChange={(e) => setNotaCocina(e.target.value)}
                    placeholder="Ej. sin cebolla, punto de la carne…"
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-border bg-muted/30 p-4">
                <Button type="button" size="lg" className="w-full" onClick={handleAgregar}>
                  <span className="flex w-full items-center justify-between">
                    <span>Agregar al pedido</span>
                    <span className="tabular-nums">{formatPeso(subtotalModal)}</span>
                  </span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal ítem libre */}
      <Dialog open={freeOpen} onOpenChange={setFreeOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
            <DialogTitle className="font-display text-xl font-semibold">Ítem libre</DialogTitle>
            <p className="text-sm text-muted-foreground">Algo que no está en la carta</p>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nombre</label>
              <Input
                value={freeNombre}
                onChange={(e) => setFreeNombre(e.target.value)}
                autoFocus
                placeholder="Ej. Torta de la abuela"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium">Precio</label>
                <Input
                  value={freePrecio}
                  onChange={(e) => setFreePrecio(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cantidad</label>
                <div className="flex items-center overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setFreeCantidad(Math.max(1, freeCantidad - 1))}
                    className="flex size-9 items-center justify-center hover:bg-muted"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{freeCantidad}</span>
                  <button
                    type="button"
                    onClick={() => setFreeCantidad(freeCantidad + 1)}
                    className="flex size-9 items-center justify-center hover:bg-muted"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Se suma solo a esta venta. No se guarda en la carta.
            </p>
            {freeError && <p className="text-sm font-medium text-destructive">{freeError}</p>}
          </div>

          <div className="border-t border-border bg-muted/30 p-4">
            <Button type="button" size="lg" className="w-full" onClick={handleAgregarLibre}>
              <span className="flex w-full items-center justify-between">
                <span>Agregar al pedido</span>
                <span className="tabular-nums">{formatPeso(freeSubtotal)}</span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
