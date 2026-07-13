'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion';
import { cn } from '@/shared/lib/utils';
import {
  colorCategoriaMeta,
  ICONOS_CATEGORIA_MAP,
  resolveIconoCategoria,
} from '@/features/menu/categoriaVisual';
import { filtrarProductosPorBusqueda } from '../buscarProductos';
import type { CategoriaMenu, ProductoMenu } from '../types';

/**
 * Vista de carta de solo lectura para la landing del local.
 * Misma presentación que MenuView (/pedir): accordion de categorías + product cards.
 * Sin carrito ni pedido: para pedir se usa /pedir o el QR de la mesa.
 */
export function CartaPublica({
  nombre,
  categorias,
  productos,
}: {
  nombre: string;
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
}) {
  const [busqueda, setBusqueda] = useState('');
  // Browse: todo cerrado; el comensal abre lo que le interesa (igual que MenuView).
  const [openCategories, setOpenCategories] = useState<string[]>([]);
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

  const totalResultados = productosFiltrados.length;

  return (
    <main className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-3">
          <Link
            href="/"
            aria-label="Volver"
            className="flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:text-foreground touch-manipulation"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{nombre}</p>
            <p className="text-xs text-muted-foreground">Carta</p>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-lg space-y-3 px-3 pb-12 pt-3">
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
                    categoriaNombre={catNombre.get(prod.categoriaId)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : secciones.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-muted-foreground">
            Todavía no hay productos cargados en la carta.
          </p>
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
                          <ProductoCard prod={prod} />
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
    </main>
  );
}

/** Card de producto alineada con MenuView, sin acción de agregar (solo lectura). */
function ProductoCard({
  prod,
  categoriaNombre,
}: {
  prod: ProductoMenu;
  /** Si viene, se muestra arriba del nombre (modo búsqueda plana). */
  categoriaNombre?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 text-left',
        'text-card-foreground shadow-sm',
      )}
    >
      <div className="min-w-0 flex-1">
        {categoriaNombre ? (
          <p className="mb-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {categoriaNombre}
          </p>
        ) : null}
        <h3 className="text-[15px] font-semibold leading-snug">{prod.nombre}</h3>
        {prod.descripcion ? (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
            {prod.descripcion}
          </p>
        ) : null}
        <p className="mt-1.5 text-[15px] font-bold tabular-nums text-primary">
          {prod.variantes.length > 0 ? (
            <span className="font-normal text-muted-foreground">desde </span>
          ) : null}
          ${Number(prod.precio).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
