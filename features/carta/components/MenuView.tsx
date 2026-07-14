'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Plus, Search, Tag, X } from 'lucide-react';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { filtrarProductosPorBusqueda } from '../buscarProductos';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion';
import {
  colorCategoriaMeta,
  ICONOS_CATEGORIA_MAP,
  resolveIconoCategoria,
} from '@/features/menu/categoriaVisual';
import { formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CategoriaMenu, ProductoMenu } from '../types';
import type {
  CartApi,
  CartPromoDisponible,
  CartPromoResumen,
  PedidoConfirmadoResumen,
} from '../cart';

// ============================================================================
// MenuView: shell presentacional del menú (mobile-first, comensal).
// Agnóstico al carrito (CartApi), confirmación y acciones de sesión/pago.
// ============================================================================

type MenuViewProps = {
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
  cart: CartApi;
  pedidosConfirmados?: PedidoConfirmadoResumen[];
  /** Si se provee, muestra el botón "Llamar al mozo" y delega la acción. */
  onLlamarMozo?: () => Promise<{ success: boolean }>;
  /** Muestra el botón "Pagar". El modal en sí lo provee `renderPagoModal`. */
  mostrarPagar?: boolean;
  /** Abrir el modal de pago apenas monta (viene del checkout externo). */
  autoAbrirPago?: boolean;
  /** Modal de pago inyectado por el caller (mantiene a carta desacoplado de pagos). */
  renderPagoModal?: (args: { open: boolean; onClose: () => void }) => ReactNode;
  confirmLabel: string;
  /**
   * Acción al confirmar el carrito.
   * `message` = error inline en el drawer.
   * `notice` = snackbar mobile de éxito (solo si el caller lo pide).
   */
  onConfirm: () => Promise<
    | { success: boolean; message?: string; notice?: Omit<MenuFeedback, 'tone'> }
    | void
  >;
  confirming: boolean;
  drawerTitulo?: string;
  /** Promos vigentes para mostrar al comensal (informativas). */
  promosDisponibles?: CartPromoDisponible[];
  /** Descuento aplicado al carrito (preview), para reflejarlo en el total. */
  promoResumen?: CartPromoResumen | null;
};

/** Feedback inline del menú (snackbar mobile, no toast de desktop). */
type MenuFeedback = {
  tone: 'success' | 'error';
  title: string;
  description?: string;
};

function ProductoCard({
  prod,
  onSelect,
  categoriaNombre,
}: {
  prod: ProductoMenu;
  onSelect: (p: ProductoMenu) => void;
  /** Si viene, se muestra arriba del nombre (modo búsqueda plana). */
  categoriaNombre?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(prod)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 text-left',
        'text-card-foreground shadow-sm transition-colors',
        // Touch: feedback al presionar (hover casi no existe en mobile).
        'active:bg-muted/60 active:scale-[0.99]',
        'touch-manipulation select-none',
      )}
    >
      <div className="min-w-0 flex-1">
        {categoriaNombre && (
          <p className="mb-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {categoriaNombre}
          </p>
        )}
        <h3 className="text-[15px] font-semibold leading-snug">{prod.nombre}</h3>
        {prod.descripcion && (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
            {prod.descripcion}
          </p>
        )}
        <p className="mt-1.5 text-[15px] font-bold tabular-nums text-primary">
          {prod.variantes.length > 0 && (
            <span className="font-normal text-muted-foreground">desde </span>
          )}
          {formatPeso(prod.precio)}
        </p>
      </div>
      {/* Target táctil ≥44px */}
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <Plus className="size-5" />
      </span>
    </button>
  );
}

export function MenuView({
  categorias,
  productos,
  cart,
  pedidosConfirmados = [],
  onLlamarMozo,
  mostrarPagar = false,
  autoAbrirPago = false,
  renderPagoModal,
  confirmLabel,
  onConfirm,
  confirming,
  drawerTitulo,
  promosDisponibles = [],
  promoResumen = null,
}: MenuViewProps) {
  const [busqueda, setBusqueda] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductoMenu | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(autoAbrirPago);
  // Primera categoría abierta: la carta no se ve vacía al escanear el QR.
  const [openCategories, setOpenCategories] = useState<string[]>(() =>
    categorias[0] ? [categorias[0].id] : [],
  );
  const [feedback, setFeedback] = useState<MenuFeedback | null>(null);

  const showFeedback = useCallback((next: MenuFeedback) => {
    setFeedback(next);
  }, []);

  // Auto-oculta el snackbar: en el celular no hay que “cerrar” notificaciones.
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const query = busqueda.trim();
  const buscando = query.length > 0;

  const catNombre = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );

  const productosFiltrados = useMemo(
    () => filtrarProductosPorBusqueda(productos, query),
    [productos, query],
  );

  const secciones = useMemo(() => {
    const byCat = new Map<string, ProductoMenu[]>();
    for (const p of productos) {
      const list = byCat.get(p.categoriaId);
      if (list) list.push(p);
      else byCat.set(p.categoriaId, [p]);
    }
    return categorias
      .map((cat) => ({
        categoria: cat,
        productos: byCat.get(cat.id) ?? [],
      }))
      .filter((s) => s.productos.length > 0);
  }, [categorias, productos]);

  const showQuickActions = !!onLlamarMozo || mostrarPagar;
  const totalResultados = productosFiltrados.length;
  const hayCtaFlotante =
    cart.items.length > 0 || pedidosConfirmados.length > 0;

  const handleLlamarMozo = async () => {
    if (!onLlamarMozo) return;
    setIsCalling(true);
    try {
      const res = await onLlamarMozo();
      if (res.success) {
        showFeedback({
          tone: 'success',
          title: 'Mozo avisado',
          description: 'En breve se acerca a la mesa.',
        });
      } else {
        showFeedback({
          tone: 'error',
          title: 'No se pudo avisar',
          description: 'Probá de nuevo en un momento.',
        });
      }
    } catch {
      showFeedback({
        tone: 'error',
        title: 'No se pudo avisar',
        description: 'Probá de nuevo en un momento.',
      });
    } finally {
      setIsCalling(false);
    }
  };

  // Snackbar solo si el caller pide `notice` (mesa sí; checkout externo no).
  const handleConfirm = async () => {
    const res = await onConfirm();
    if (res?.success && res.notice) {
      showFeedback({
        tone: 'success',
        title: res.notice.title,
        description: res.notice.description,
      });
    }
    return res;
  };

  return (
    <div
      className={cn(
        'relative mx-auto min-h-dvh w-full max-w-lg bg-muted/30',
        // Espacio para el CTA flotante + safe area (notch / home bar).
        'pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]',
      )}
    >
      {/* Solo acciones de mesa sticky (si hay). El search NO va acá: debajo
          del título de página se sentía como una segunda barra rara. */}
      {showQuickActions && (
        <div className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-md">
          {onLlamarMozo && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-3.5 text-sm touch-manipulation"
              onClick={handleLlamarMozo}
              disabled={isCalling}
            >
              {isCalling ? 'Llamando…' : 'Llamar mozo'}
            </Button>
          )}
          {mostrarPagar && (
            <Button
              size="sm"
              className="h-9 rounded-full px-4 text-sm touch-manipulation"
              onClick={() => setShowPaymentModal(true)}
            >
              Pagar
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3 px-3 pt-3">
        {promosDisponibles.length > 0 && !buscando && (
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Tag className="size-3 text-primary" aria-hidden />
              Promos
            </span>
            {promosDisponibles.map((promo) => (
              <span
                key={promo.id}
                title={promo.condicion}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-sidebar-accent px-2.5 py-1 text-xs text-sidebar-accent-foreground"
              >
                <span className="font-bold tabular-nums">{promo.badge}</span>
                <span className="max-w-[9rem] truncate font-medium">{promo.nombre}</span>
              </span>
            ))}
          </div>
        )}

        {/* Search en el flujo del contenido, encima del menú (no sticky). */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/80"
            aria-hidden
          />
          <Input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar plato o bebida…"
            // text-base (≥16px) evita zoom automático en iOS al focus.
            // Ocultamos el clear nativo de type=search (cruz azul en Edge/Chrome)
            // porque ya tenemos botón propio.
            className={cn(
              'h-11 rounded-full border-border/70 bg-card pr-11 pl-10 text-base shadow-none touch-manipulation',
              'placeholder:text-muted-foreground/70',
              'focus-visible:border-primary/40 focus-visible:ring-primary/15',
              '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
              '[&::-ms-clear]:hidden',
            )}
            aria-label="Buscar en el menú"
          />
          {busqueda.length > 0 && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted touch-manipulation"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" strokeWidth={2.25} />
            </button>
          )}
        </div>

        {buscando && (
          <p className="px-0.5 text-xs text-muted-foreground">
            {totalResultados === 0
              ? `Sin resultados para “${query}”`
              : `${totalResultados} resultado${totalResultados === 1 ? '' : 's'}`}
          </p>
        )}

        {buscando ? (
          // Búsqueda: lista plana (más natural en el celular).
          totalResultados === 0 ? (
            <p className="px-2 py-12 text-center text-sm text-muted-foreground">
              Probá con otro nombre.
            </p>
          ) : (
            <ul className="space-y-2">
              {productosFiltrados.map((prod) => (
                <li key={prod.id}>
                  <ProductoCard
                    prod={prod}
                    onSelect={setSelectedProduct}
                    categoriaNombre={catNombre.get(prod.categoriaId)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : secciones.length === 0 ? (
          <div className="space-y-2 px-2 py-14 text-center">
            <p className="text-base font-medium text-foreground">El menú aún no está cargado</p>
            <p className="text-sm text-muted-foreground">
              Avisale al mozo o al local. En cuanto carguen los platos, aparecen acá.
            </p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openCategories}
            onValueChange={setOpenCategories}
            className="rounded-2xl border bg-card shadow-sm"
          >
            {secciones.map(({ categoria, productos: prods }) => {
              const meta = colorCategoriaMeta(categoria.color);
              const Icon = ICONOS_CATEGORIA_MAP[resolveIconoCategoria(categoria.icono)];
              return (
                <AccordionItem key={categoria.id} value={categoria.id}>
                  <AccordionTrigger
                    className={cn(
                      'min-h-14 touch-manipulation px-3.5 py-3 hover:no-underline',
                      'active:bg-muted/40',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: meta.soft, color: meta.hex }}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="truncate text-[15px] font-semibold leading-tight">
                        {categoria.nombre}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {prods.length}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2.5 pb-3">
                    <ul className="space-y-2">
                      {prods.map((prod) => (
                        <li key={prod.id}>
                          <ProductoCard prod={prod} onSelect={setSelectedProduct} />
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          cart={cart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      <FloatingCart
        cart={cart}
        pedidosConfirmados={pedidosConfirmados}
        confirmLabel={confirmLabel}
        onConfirm={handleConfirm}
        confirming={confirming}
        titulo={drawerTitulo}
        promoResumen={promoResumen}
      />

      {/* Snackbar mobile: arriba del CTA flotante, full-width del layout. */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-50 px-3 duration-200 animate-in fade-in slide-in-from-bottom-3"
          style={{
            bottom: hayCtaFlotante
              ? 'calc(5.25rem + env(safe-area-inset-bottom, 0px))'
              : 'max(1rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="mx-auto max-w-lg">
            <div
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-lg',
                feedback.tone === 'success' &&
                  'border-success/25 bg-success-subtle text-success-foreground',
                feedback.tone === 'error' &&
                  'border-destructive/25 bg-destructive-subtle text-destructive',
              )}
            >
              {feedback.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">{feedback.title}</p>
                {feedback.description && (
                  <p className="mt-0.5 text-sm leading-snug opacity-90">
                    {feedback.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="pointer-events-auto -mr-1 -mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full opacity-70 touch-manipulation active:opacity-100"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPagoModal?.({
        open: showPaymentModal,
        onClose: () => setShowPaymentModal(false),
      })}
    </div>
  );
}
