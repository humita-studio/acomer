'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

/**
 * Carga Leaflet solo en el cliente (SSR no tiene `window`).
 */
export const ZonaEntregaMapaLazy = dynamic(
  () => import('./ZonaEntregaMapa').then((m) => m.ZonaEntregaMapa),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] min-h-[280px] items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  },
);

export type ZonaEntregaMapaLazyProps = ComponentProps<typeof ZonaEntregaMapaLazy>;
