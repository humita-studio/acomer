'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Bike, Loader2, Search } from 'lucide-react';
import { buscarAdminAction, type BusquedaHit } from '@/features/busqueda/busquedaActions';
import { queryKeys } from '@/shared/query/keys';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';

const DEBOUNCE_MS = 250;

function ResultIcon({ kind }: { kind: BusquedaHit['kind'] }) {
  if (kind === 'mesa') {
    return <Armchair className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <Bike className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

/**
 * Buscador del header admin: mesas (identificador) y pedidos online
 * (nombre / teléfono / dirección). Navega al detalle o al tablero con highlight.
 */
export function AdminSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= 1;

  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.adminSearch(debounced),
    queryFn: () => buscarAdminAction(debounced),
    enabled,
    staleTime: 15_000,
  });

  // Solo mostrar hits del query debounced actual (evita flash de resultados viejos).
  const results =
    enabled && data?.success && debounced === query.trim() ? data.results : [];
  const waitingDebounce = query.trim().length >= 1 && query.trim() !== debounced;
  const showPanel = open && query.trim().length >= 1;
  const safeActive =
    activeIndex >= 0 && activeIndex < results.length ? activeIndex : -1;

  // Cerrar al click afuera.
  useEffect(() => {
    if (!showPanel) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [showPanel]);

  const goTo = useCallback(
    (hit: BusquedaHit) => {
      setOpen(false);
      setQuery('');
      setDebounced('');
      router.push(hit.href);
    },
    [router],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!showPanel || results.length === 0) {
      if (e.key === 'ArrowDown' && enabled) setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const hit = safeActive >= 0 ? results[safeActive] : results[0];
      if (hit) goTo(hit);
    }
  };

  return (
    <div ref={rootRef} className="relative hidden w-full max-w-xs sm:block">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar pedidos, mesas…"
        className="pl-9 pr-9"
        aria-label="Buscar pedidos y mesas"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showPanel}
        aria-activedescendant={
          safeActive >= 0 ? `${listId}-opt-${safeActive}` : undefined
        }
        role="combobox"
        autoComplete="off"
      />
      {isFetching && enabled ? (
        <Loader2
          className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Resultados de búsqueda"
          className="absolute top-[calc(100%+6px)] left-0 z-50 w-full min-w-[18rem] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5"
        >
          {isError || (enabled && data?.success === false) ? (
            <p className="px-3 py-3 text-sm text-destructive">
              No se pudo buscar. Intentá de nuevo.
            </p>
          ) : waitingDebounce || (isFetching && results.length === 0) ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Sin resultados para “{debounced}”
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto p-1">
              {results.map((hit, index) => {
                const active = index === safeActive;
                return (
                  <li key={`${hit.kind}-${hit.id}`} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(hit)}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/80',
                      )}
                    >
                      <span className="mt-0.5">
                        <ResultIcon kind={hit.kind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium leading-tight">
                          {hit.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {hit.kind === 'mesa' ? 'Mesa · ' : 'Pedido · '}
                          {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
