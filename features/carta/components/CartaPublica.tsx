import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatPeso } from '@/shared/lib/format';
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
  // Productos agrupados por categoría, respetando el orden de las categorías y
  // descartando las que quedan vacías.
  const secciones = categorias
    .map((cat) => ({ cat, items: productos.filter((p) => p.categoriaId === cat.id) }))
    .filter((s) => s.items.length > 0);

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

      <div className="mx-auto max-w-md px-4 pb-12 pt-4">
        {secciones.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Todavía no hay productos cargados en la carta.
          </p>
        ) : (
          <div className="space-y-8">
            {secciones.map(({ cat, items }) => (
              <section key={cat.id}>
                <h2 className="font-display text-2xl font-semibold">{cat.nombre}</h2>
                <ul className="mt-3 divide-y">
                  {items.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
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
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
