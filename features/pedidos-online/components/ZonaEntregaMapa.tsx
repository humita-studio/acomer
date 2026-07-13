'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, Pencil, RotateCcw, Check, Trash2, GripVertical } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { geocodeDireccionAction } from '../geocode';
import {
  MAPA_DEFAULT_CENTER,
  MAPA_DEFAULT_ZOOM,
  ZONA_MAX_VERTICES,
  boundsPoligono,
  centroidePoligono,
  latLngsToPolygon,
  puntoEnZona,
  ringToLatLngs,
  type LatLng,
  type ZonaPoligono,
} from '../zonaMapa';

export type ZonaMapaMode = 'edit' | 'view' | 'pick';

type Props = {
  mode: ZonaMapaMode;
  value: ZonaPoligono | null;
  /** En mode=edit: al cerrar, arrastrar vértices o borrar. */
  onChange?: (poly: ZonaPoligono | null) => void;
  /** En mode=pick: pin del cliente. */
  pin?: LatLng | null;
  onPinChange?: (pin: LatLng | null) => void;
  /**
   * Dirección del local (landing) para centrar el mapa al dibujar.
   * Se geocodifica con Nominatim si no hay polígono aún.
   */
  direccionLocal?: string;
  /** Centro explícito (si ya se resolvió afuera). */
  initialCenter?: LatLng | null;
  className?: string;
  /** Altura del mapa. */
  height?: number | string;
};

const ZONE_STYLE = {
  color: '#c2562f',
  weight: 2,
  fillColor: '#c2562f',
  fillOpacity: 0.22,
} as const;

const DRAFT_STYLE = {
  color: '#c2562f',
  weight: 2,
  dashArray: '6 4',
  fillColor: '#c2562f',
  fillOpacity: 0.12,
} as const;

function vertexIcon(L: typeof import('leaflet'), label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;border-radius:9999px;
      background:#c2562f;border:2.5px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 10px/1 system-ui,sans-serif;
      cursor:grab;user-select:none;
    ">${label}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/**
 * Mapa de zona de entrega (Leaflet + OSM).
 * - edit: dibujar + arrastrar vértices del polígono cerrado
 * - view: solo muestra la zona
 * - pick: el cliente marca un pin (debe caer dentro de la zona si hay polígono)
 */
export function ZonaEntregaMapa({
  mode,
  value,
  onChange,
  pin,
  onPinChange,
  direccionLocal,
  initialCenter,
  className,
  height = 420,
}: Props) {
  const mapId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localMarkerRef = useRef<any>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);

  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [hint, setHint] = useState('');
  const [geoLabel, setGeoLabel] = useState<string | null>(null);

  const valueRef = useRef(value);
  valueRef.current = value;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const pinRefState = useRef(pin);
  pinRefState.current = pin;

  /** Evita pan/fit en cada drag de vértice. */
  const skipNextFitRef = useRef(false);

  const redraw = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const poly = valueRef.current;
    const d = draftRef.current;
    const editing = modeRef.current === 'edit' && !drawingRef.current && poly;

    // Polígono cerrado + vértices arrastrables en edit.
    if (poly && !drawingRef.current) {
      const pts = ringToLatLngs(poly.coordinates[0] ?? []);
      const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
      if (latlngs.length >= 3) {
        L.polygon(latlngs, ZONE_STYLE).addTo(group);

        if (editing) {
          pts.forEach((p, i) => {
            const marker = L.marker([p.lat, p.lng], {
              draggable: true,
              icon: vertexIcon(L, String(i + 1)),
              zIndexOffset: 500,
            }).addTo(group);

            // Mover el vértice y reemitir el polígono (sin re-fit del mapa).
            marker.on('dragend', () => {
              const ll = marker.getLatLng();
              const current = ringToLatLngs(valueRef.current?.coordinates[0] ?? []);
              if (current.length < 3) return;
              const next = current.map((pt, idx) =>
                idx === i ? { lat: ll.lat, lng: ll.lng } : pt,
              );
              const nuevo = latLngsToPolygon(next);
              if (!nuevo) return;
              skipNextFitRef.current = true;
              setHint('Vértice movido. Guardá la configuración para aplicar.');
              onChangeRef.current?.(nuevo);
            });
          });
        }
      }
    }

    // Borrador mientras se dibuja.
    if (drawingRef.current && d.length > 0) {
      const latlngs = d.map((p) => [p.lat, p.lng] as [number, number]);
      d.forEach((p, i) => {
        L.marker([p.lat, p.lng], {
          icon: vertexIcon(L, String(i + 1)),
          interactive: false,
        }).addTo(group);
      });
      if (d.length >= 2) {
        L.polyline(latlngs, { color: '#c2562f', weight: 2, dashArray: '6 4' }).addTo(group);
      }
      if (d.length >= 3) {
        L.polygon(latlngs, DRAFT_STYLE).addTo(group);
      }
    }

    // Pin del cliente
    if (pinRef.current) {
      map.removeLayer(pinRef.current);
      pinRef.current = null;
    }
    const p = pinRefState.current;
    if (p && (modeRef.current === 'pick' || modeRef.current === 'view')) {
      pinRef.current = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      })
        .bindTooltip('Tu ubicación', { direction: 'top', offset: [0, -8] })
        .addTo(map);
    }
  }, []);

  // Init mapa una sola vez.
  useEffect(() => {
    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      LRef.current = L;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const start =
        centroidePoligono(valueRef.current) ??
        initialCenter ??
        MAPA_DEFAULT_CENTER;

      map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: MAPA_DEFAULT_ZOOM,
        scrollWheelZoom: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      const b = boundsPoligono(valueRef.current);
      if (b) {
        map.fitBounds(b, { padding: [36, 36], maxZoom: 15 });
      }

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const pt: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
        const m = modeRef.current;

        if (m === 'edit' && drawingRef.current) {
          setDraft((prev) => {
            if (prev.length >= ZONA_MAX_VERTICES) return prev;
            return [...prev, pt];
          });
          return;
        }

        if (m === 'pick') {
          const poly = valueRef.current;
          if (poly && !puntoEnZona(poly, pt)) {
            setHint(
              'Ese punto está fuera de la zona de entrega. Elegí un punto dentro del área naranja.',
            );
            return;
          }
          setHint('');
          onPinChangeRef.current?.(pt);
        }
      });

      setReady(true);
      requestAnimationFrame(() => {
        map?.invalidateSize();
        redraw();
      });
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      layerRef.current = null;
      pinRef.current = null;
      localMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocodificar dirección del local para centrar (si no hay polígono).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (value) return; // ya hay zona: el fitBounds se encarga

    let cancelled = false;

    (async () => {
      let center: LatLng | null = initialCenter ?? null;

      if (!center && direccionLocal?.trim()) {
        setGeoLabel('Buscando dirección del local…');
        center = await geocodeDireccionAction(direccionLocal);
      }

      if (cancelled || !mapRef.current) return;

      if (center) {
        mapRef.current.setView([center.lat, center.lng], 15, { animate: true });
        setGeoLabel(
          direccionLocal?.trim()
            ? `Centrado en: ${direccionLocal.trim()}`
            : null,
        );

        // Marca del local (solo en edit, para orientar al dibujar).
        const L = LRef.current;
        if (L && modeRef.current === 'edit') {
          if (localMarkerRef.current) {
            mapRef.current.removeLayer(localMarkerRef.current);
          }
          localMarkerRef.current = L.circleMarker([center.lat, center.lng], {
            radius: 7,
            color: '#fff',
            weight: 2,
            fillColor: '#1d4ed8',
            fillOpacity: 1,
          })
            .bindTooltip('Tu local', { permanent: false, direction: 'top' })
            .addTo(mapRef.current);
        }
      } else if (direccionLocal?.trim()) {
        setGeoLabel('No encontramos esa dirección en el mapa. Podés dibujar igual.');
      } else {
        setGeoLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, direccionLocal, initialCenter, value]);

  // Redibujar cuando cambian value / draft / drawing / pin.
  useEffect(() => {
    if (!ready) return;
    redraw();
  }, [ready, value, draft, drawing, pin, redraw]);

  // Sheets/modales: el contenedor a veces monta con tamaño 0.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    const t2 = window.setTimeout(() => map.invalidateSize(), 400);
    const ro =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => map.invalidateSize())
        : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      ro?.disconnect();
    };
  }, [ready, height]);

  // Fit bounds cuando llega un polígono nuevo (no en cada drag).
  useEffect(() => {
    if (!ready || !mapRef.current || !value) return;
    if (mode === 'edit' && drawing) return;
    if (skipNextFitRef.current) {
      skipNextFitRef.current = false;
      return;
    }
    const b = boundsPoligono(value);
    if (b) {
      mapRef.current.fitBounds(b, { padding: [36, 36], maxZoom: 15 });
    }
  }, [ready, value, mode, drawing]);

  const startDraw = () => {
    setDrawing(true);
    setDraft([]);
    setHint('Tocá el mapa para marcar los vértices (mínimo 3). Después cerrá la zona.');
  };

  const undoPoint = () => {
    setDraft((d) => d.slice(0, -1));
  };

  const closeZone = () => {
    const poly = latLngsToPolygon(draft);
    if (!poly) {
      setHint('Necesitás al menos 3 puntos para cerrar la zona.');
      return;
    }
    setDrawing(false);
    setDraft([]);
    setHint('Zona lista. Arrastrá los puntos naranjas para ajustar, o guardá la configuración.');
    onChange?.(poly);
  };

  const clearZone = () => {
    setDrawing(false);
    setDraft([]);
    setHint('Zona borrada.');
    onChange?.(null);
  };

  const hasZone = Boolean(value);
  const pinOk = pin ? (value ? puntoEnZona(value, pin) : true) : false;
  const heightCss = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="relative overflow-hidden rounded-xl border bg-muted"
        style={{ height: heightCss, minHeight: typeof height === 'number' ? height : undefined }}
      >
        <div
          ref={containerRef}
          id={`zona-map-${mapId}`}
          className="absolute inset-0 z-0 h-full w-full"
        />
        {!ready ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted text-sm text-muted-foreground">
            Cargando mapa…
          </div>
        ) : null}
      </div>

      {mode === 'edit' ? (
        <div className="flex flex-wrap gap-2">
          {!drawing ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={hasZone ? 'outline' : 'default'}
                onClick={startDraw}
              >
                <Pencil className="size-3.5" />
                {hasZone ? 'Redibujar zona' : 'Dibujar zona'}
              </Button>
              {hasZone ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={clearZone}
                >
                  <Trash2 className="size-3.5" />
                  Borrar zona
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button type="button" size="sm" onClick={closeZone} disabled={draft.length < 3}>
                <Check className="size-3.5" />
                Cerrar zona ({draft.length} pts)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={undoPoint}
                disabled={draft.length === 0}
              >
                <RotateCcw className="size-3.5" />
                Deshacer punto
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDrawing(false);
                  setDraft([]);
                  setHint('');
                }}
              >
                Cancelar
              </Button>
            </>
          )}
        </div>
      ) : null}

      {mode === 'edit' && hasZone && !drawing ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <GripVertical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Arrastrá los puntos naranjas para ajustar la zona sin redibujarla.
        </p>
      ) : null}

      {mode === 'pick' ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {pin
            ? pinOk
              ? 'Ubicación marcada dentro de la zona.'
              : 'La marca está fuera de la zona.'
            : value
              ? 'Tocá el mapa dentro del área naranja para marcar dónde entregamos.'
              : 'Tocá el mapa para marcar el punto de entrega.'}
        </p>
      ) : null}

      {mode === 'view' && !value ? (
        <p className="text-xs text-muted-foreground">El local aún no dibujó una zona en el mapa.</p>
      ) : null}

      {geoLabel ? <p className="text-xs text-muted-foreground">{geoLabel}</p> : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
