'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, X } from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import {
  colorCategoriaMeta,
  ICONOS_CATEGORIA_MAP,
  resolveIconoCategoria,
} from '@/features/menu/categoriaVisual';
import { filtrarProductosPorBusqueda } from '../buscarProductos';
import type { CategoriaMenu, ProductoMenu } from '../types';

/**
 * Vista de carta de solo lectura para la landing del local: lista categorías y
 * productos con su precio, sin armar pedido. Para pedir se usa /pedir (online) o
 * el QR de la mesa.
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

  // Productos agrupados por categoría, respetando el orden de las categorías y
  // descartando las que quedan vacías.
  const secciones = useMemo(
    () =>
      categorias
        .map((cat) => ({
          cat,
          items: productos.filter((p) => p.categoriaId === cat.id),
        }))
        .filter((s) => s.items.length > 0),
    [categorias, productos],
  );

  const totalResultados = productosFiltrados.length;

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
          <Link
            href="/"
            aria-label="Volver"
            className="flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{nombre}</p>
            <p className="text-xs text-muted-foreground">Carta</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pb-12 pt-4">
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
            <p className="py-12 text-center text-sm text-muted-foreground">
              Probá con otro nombre.
            </p>
          ) : (
            <ul className="divide-y">
              {productosFiltrados.map((p) => (
                <ProductoRow
                  key={p.id}
                  producto={p}
                  categoriaNombre={catNombre.get(p.categoriaId)}
                />
              ))}
            </ul>
          )
        ) : secciones.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Todavía no hay productos cargados en la carta.
          </p>
        ) : (
          <div className="space-y-8">
            {secciones.map(({ cat, items }) => {
              const meta = colorCategoriaMeta(cat.color);
              const Icon = ICONOS_CATEGORIA_MAP[resolveIconoCategoria(cat.icono)];
              return (
                <section key={cat.id}>
                  <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold">
                    <span
                      className="flex size-9 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: meta.hex }}
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    {cat.nombre}
                  </h2>
                  <ul className="mt-3 divide-y">
                    {items.map((p) => (
                      <ProductoRow key={p.id} producto={p} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function ProductoRow({
  producto: p,
  categoriaNombre,
}: {
  producto: ProductoMenu;
  /** Si viene, se muestra arriba del nombre (modo búsqueda plana). */
  categoriaNombre?: string;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        {categoriaNombre ? (
          <p className="mb-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {categoriaNombre}
          </p>
        ) : null}
        <p className="font-medium">{p.nombre}</p>
        {p.descripcion ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{p.descripcion}</p>
        ) : null}
      </div>
      <p className="shrink-0 font-semibold tabular-nums">
        {p.variantes.length > 0 ? (
          <span className="text-sm font-normal text-muted-foreground">desde </span>
        ) : null}
        {formatPeso(p.precio)}
      </p>
    </li>
  );
}
