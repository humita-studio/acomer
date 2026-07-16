'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, Pencil, RotateCcw, Check, Trash2, GripVertical, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { geocodeDireccionAction } from './geocode';
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
} from './zonaMapa';

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
  /**
   * En mode=edit sin zona: arranca en modo dibujo apenas carga el mapa.
   * @default true
   */
  autoStartDraw?: boolean;
};

const ZONE_STYLE = {
  color: '#c2562f',
  weight: 2.5,
  fillColor: '#c2562f',
  fillOpacity: 0.22,
} as const;

const GHOST_STYLE = {
  color: '#c2562f',
  weight: 2,
  dashArray: '6 5',
  fillColor: '#c2562f',
  fillOpacity: 0.06,
  opacity: 0.45,
} as const;

const DRAFT_STYLE = {
  color: '#c2562f',
  weight: 2,
  dashArray: '6 4',
  fillColor: '#c2562f',
  fillOpacity: 0.12,
} as const;

const RUBBER_STYLE = {
  color: '#c2562f',
  weight: 2,
  dashArray: '4 6',
  opacity: 0.75,
} as const;

/** Distancia en px del mapa para "click cerca del primer punto = cerrar". */
const CLOSE_SNAP_PX = 28;

/** Reset del contenedor del divIcon de Leaflet. */
const VERTEX_ICON_STYLE = `
.zona-vertex-icon {
  background: transparent !important;
  border: none !important;
}
`;

function vertexIcon(
  L: typeof import('leaflet'),
  label: string,
  opts?: { first?: boolean; active?: boolean },
) {
  const size = opts?.first ? 22 : 18;
  const bg = opts?.first ? '#9a3412' : '#c2562f';
  const ring = opts?.active ? '0 0 0 3px rgba(194,86,47,.35)' : '0 1px 4px rgba(0,0,0,.35)';
  return L.divIcon({
    className: 'zona-vertex-icon',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${bg};border:2.5px solid #fff;
      box-shadow:${ring};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 10px/1 system-ui,sans-serif;
      cursor:grab;user-select:none;touch-action:none;
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function distPx(map: import('leaflet').Map, a: LatLng, b: LatLng): number {
  const pa = map.latLngToContainerPoint([a.lat, a.lng]);
  const pb = map.latLngToContainerPoint([b.lat, b.lng]);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

function polyToLatLngs(poly: ZonaPoligono | null | undefined): LatLng[] {
  if (!poly) return [];
  return ringToLatLngs(poly.coordinates[0] ?? []);
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
  autoStartDraw = true,
}: Props) {
  const mapId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polyLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rubberRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localMarkerRef = useRef<any>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const editPtsRef = useRef<LatLng[]>([]);
  const draggingVertexRef = useRef(false);
  const cursorRef = useRef<LatLng | null>(null);
  const autoStartedRef = useRef(false);
  /** Evita pan/fit en cada drag de vértice. */
  const skipNextFitRef = useRef(false);

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

  const setMapCursor = useCallback((style: string) => {
    const el = mapRef.current?.getContainer?.() as HTMLElement | undefined;
    if (el) el.style.cursor = style;
  }, []);

  /**
   * Recalcula tamaño del contenedor y encuadra la zona.
   * Crítico en modales/sheets: Leaflet a menudo monta con 0×0.
   */
  const fitToZone = useCallback((poly?: ZonaPoligono | null, opts?: { animate?: boolean }) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.invalidateSize({ animate: false });
    } catch {
      /* ignore */
    }
    const target = poly === undefined ? valueRef.current : poly;
    const b = boundsPoligono(target);
    if (b) {
      map.fitBounds(b, {
        padding: [40, 40],
        maxZoom: 16,
        animate: opts?.animate ?? false,
      });
      return;
    }
    const c = centroidePoligono(target);
    if (c) {
      map.setView([c.lat, c.lng], 14, { animate: opts?.animate ?? false });
    }
  }, []);

  const finishDraft = useCallback(
    (points: LatLng[]) => {
      const poly = latLngsToPolygon(points);
      if (!poly) {
        setHint('Necesitás al menos 3 puntos para cerrar la zona.');
        return false;
      }
      setDrawing(false);
      setDraft([]);
      cursorRef.current = null;
      setHint('Zona lista. Arrastrá los puntos naranjas para ajustar, o usá esta zona.');
      setMapCursor('');
      skipNextFitRef.current = false;
      onChangeRef.current?.(poly);
      // Encuadrar en el siguiente frame (cuando value ya llegó / layers se redibujaron).
      requestAnimationFrame(() => fitToZone(poly));
      return true;
    },
    [setMapCursor, fitToZone],
  );

  const redraw = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (draggingVertexRef.current) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    polyLayerRef.current = null;
    if (rubberRef.current) {
      map.removeLayer(rubberRef.current);
      rubberRef.current = null;
    }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const poly = valueRef.current;
    const d = draftRef.current;
    const editing = modeRef.current === 'edit' && !drawingRef.current && Boolean(poly);
    const pts = polyToLatLngs(poly);

    // Fantasma de la zona actual mientras se redibuja (no “desaparece”).
    if (drawingRef.current && pts.length >= 3) {
      L.polygon(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        GHOST_STYLE,
      ).addTo(group);
    }

    // Polígono cerrado + vértices arrastrables en edit.
    if (poly && !drawingRef.current && pts.length >= 3) {
      editPtsRef.current = pts.map((p) => ({ ...p }));
      const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
      const polyLayer = L.polygon(latlngs, ZONE_STYLE).addTo(group);
      polyLayerRef.current = polyLayer;

      if (editing) {
        pts.forEach((p, i) => {
          const marker = L.marker([p.lat, p.lng], {
            draggable: true,
            icon: vertexIcon(L, String(i + 1)),
            zIndexOffset: 500,
            autoPan: true,
          }).addTo(group);

          marker.on('dragstart', () => {
            draggingVertexRef.current = true;
          });
          marker.on('drag', () => {
            const ll = marker.getLatLng();
            const next = editPtsRef.current.map((pt, idx) =>
              idx === i ? { lat: ll.lat, lng: ll.lng } : pt,
            );
            editPtsRef.current = next;
            polyLayer.setLatLngs(next.map((pt) => [pt.lat, pt.lng] as [number, number]));
          });
          marker.on('dragend', () => {
            const ll = marker.getLatLng();
            const next = editPtsRef.current.map((pt, idx) =>
              idx === i ? { lat: ll.lat, lng: ll.lng } : pt,
            );
            editPtsRef.current = next;
            const nuevo = latLngsToPolygon(next);
            draggingVertexRef.current = false;
            if (!nuevo) return;
            skipNextFitRef.current = true;
            setHint('Vértice movido. Guardá la configuración para aplicar.');
            onChangeRef.current?.(nuevo);
          });

          marker.on('dblclick', (e: import('leaflet').LeafletMouseEvent) => {
            L.DomEvent.stop(e);
            const current = editPtsRef.current;
            if (current.length <= 3) {
              setHint('La zona necesita al menos 3 puntos. Redibujá o mové los vértices.');
              return;
            }
            const next = current.filter((_, idx) => idx !== i);
            const nuevo = latLngsToPolygon(next);
            if (!nuevo) return;
            skipNextFitRef.current = true;
            setHint('Punto eliminado. Doble clic en un punto para quitarlo.');
            onChangeRef.current?.(nuevo);
          });
        });
      }
    }

    // Borrador mientras se dibuja.
    if (drawingRef.current && d.length > 0) {
      const latlngs = d.map((p) => [p.lat, p.lng] as [number, number]);
      d.forEach((p, i) => {
        const isFirst = i === 0;
        L.marker([p.lat, p.lng], {
          icon: vertexIcon(L, String(i + 1), {
            first: isFirst && d.length >= 3,
            active: isFirst && d.length >= 3,
          }),
          interactive: false,
          zIndexOffset: 400,
        }).addTo(group);
      });
      if (d.length >= 2) {
        L.polyline(latlngs, { color: '#c2562f', weight: 2.5, dashArray: '6 4' }).addTo(group);
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

  const redrawRubber = useCallback((cursorPt: LatLng | null) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (rubberRef.current) {
      map.removeLayer(rubberRef.current);
      rubberRef.current = null;
    }

    if (!drawingRef.current || !cursorPt) return;
    const d = draftRef.current;
    if (d.length === 0) return;

    const last = d[d.length - 1];
    const segs: [number, number][] = [
      [last.lat, last.lng],
      [cursorPt.lat, cursorPt.lng],
    ];
    if (d.length >= 2) {
      segs.push([d[0].lat, d[0].lng]);
    }
    rubberRef.current = L.polyline(segs, RUBBER_STYLE).addTo(map);
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
        centroidePoligono(valueRef.current) ?? initialCenter ?? MAPA_DEFAULT_CENTER;

      map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: MAPA_DEFAULT_ZOOM,
        scrollWheelZoom: true,
        doubleClickZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const pt: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
        const m = modeRef.current;

        if (m === 'edit' && drawingRef.current) {
          const d = draftRef.current;
          if (d.length >= 3 && map) {
            if (distPx(map, d[0], pt) <= CLOSE_SNAP_PX) {
              finishDraft(d);
              return;
            }
          }
          if (d.length >= ZONA_MAX_VERTICES) {
            setHint(`Máximo ${ZONA_MAX_VERTICES} puntos. Cerrá la zona o deshacé alguno.`);
            return;
          }
          setDraft((prev) => [...prev, pt]);
          setHint(
            d.length + 1 < 3
              ? `Punto ${d.length + 1}. Necesitás al menos 3.`
              : 'Tocá más puntos, o el primero / “Cerrar zona” para terminar.',
          );
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

      map.on('dblclick', (e: import('leaflet').LeafletMouseEvent) => {
        if (modeRef.current !== 'edit' || !drawingRef.current) return;
        L.DomEvent.stop(e);
        const d = draftRef.current;
        if (d.length >= 3) {
          finishDraft(d);
        } else {
          setHint('Necesitás al menos 3 puntos para cerrar la zona.');
        }
      });

      map.on('mousemove', (e: import('leaflet').LeafletMouseEvent) => {
        if (!drawingRef.current) return;
        const pt: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
        cursorRef.current = pt;
        redrawRubber(pt);
      });

      map.on('mouseout', () => {
        if (!drawingRef.current) return;
        cursorRef.current = null;
        redrawRubber(null);
      });

      setReady(true);
      // Encuadre inicial: esperar a que el dialog/sheet tenga tamaño real.
      requestAnimationFrame(() => {
        if (cancelled || !map) return;
        map.invalidateSize({ animate: false });
        redraw();
        fitToZone(valueRef.current);
      });
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      layerRef.current = null;
      polyLayerRef.current = null;
      rubberRef.current = null;
      pinRef.current = null;
      localMarkerRef.current = null;
      draggingVertexRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocodificar dirección del local para centrar (si no hay polígono).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (value) return;

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
          direccionLocal?.trim() ? `Centrado en: ${direccionLocal.trim()}` : null,
        );

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

  // Auto-iniciar dibujo solo si no hay zona (una vez por montaje).
  useEffect(() => {
    if (!ready || mode !== 'edit' || !autoStartDraw) return;
    if (value || autoStartedRef.current) return;
    autoStartedRef.current = true;
    setDrawing(true);
    setDraft([]);
    setHint(
      'Tocá el mapa para marcar los vértices (mínimo 3). Doble clic o el primer punto para cerrar.',
    );
    setMapCursor('crosshair');
  }, [ready, mode, value, autoStartDraw, setMapCursor]);

  useEffect(() => {
    if (!ready) return;
    setMapCursor(drawing && mode === 'edit' ? 'crosshair' : '');
  }, [ready, drawing, mode, setMapCursor]);

  useEffect(() => {
    if (!drawing || mode !== 'edit') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawing(false);
        setDraft([]);
        cursorRef.current = null;
        setHint(valueRef.current ? 'Seguís con la zona anterior.' : '');
        setMapCursor('');
        // Volver a mostrar la zona previa.
        requestAnimationFrame(() => {
          redraw();
          fitToZone();
        });
      } else if (e.key === 'Enter' && draftRef.current.length >= 3) {
        e.preventDefault();
        finishDraft(draftRef.current);
      } else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawing, mode, finishDraft, setMapCursor, redraw, fitToZone]);

  // Redibujar cuando cambian value / draft / drawing / pin.
  useEffect(() => {
    if (!ready) return;
    redraw();
    if (drawing) redrawRubber(cursorRef.current);
  }, [ready, value, draft, drawing, pin, redraw, redrawRubber]);

  // En pick: si el pin llega de afuera (GPS / geocode de dirección), centrar el mapa.
  useEffect(() => {
    if (!ready || mode !== 'pick' || !pin || !mapRef.current) return;
    try {
      mapRef.current.panTo([pin.lat, pin.lng], { animate: true, duration: 0.35 });
    } catch {
      /* ignore */
    }
  }, [ready, mode, pin?.lat, pin?.lng]);

  // Modal/sheet: re-encuadrar cuando el contenedor gana tamaño real (Leaflet 0×0).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    let lastW = 0;
    let lastH = 0;

    const refresh = (forceFit: boolean) => {
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      const becameVisible =
        (lastW < 40 || lastH < 40) && size.x >= 40 && size.y >= 40;
      lastW = size.x;
      lastH = size.y;
      if (
        (forceFit || becameVisible) &&
        !drawingRef.current &&
        valueRef.current &&
        !skipNextFitRef.current
      ) {
        fitToZone(valueRef.current);
      }
    };

    // Varios ticks: animación del dialog + layout del sheet.
    const t1 = window.setTimeout(() => refresh(true), 50);
    const t2 = window.setTimeout(() => refresh(true), 200);
    const t3 = window.setTimeout(() => refresh(true), 500);
    const t4 = window.setTimeout(() => refresh(true), 1000);

    const ro =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => refresh(false))
        : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      ro?.disconnect();
    };
  }, [ready, height, fitToZone]);

  // Fit bounds cuando llega un polígono nuevo (no en cada drag).
  useEffect(() => {
    if (!ready || !mapRef.current || !value) return;
    if (mode === 'edit' && drawing) return;
    if (skipNextFitRef.current) {
      skipNextFitRef.current = false;
      return;
    }
    fitToZone(value);
  }, [ready, value, mode, drawing, fitToZone]);

  const startDraw = () => {
    setDrawing(true);
    setDraft([]);
    cursorRef.current = null;
    setHint(
      value
        ? 'Redibujando: la zona actual se ve tenue. Marcá los nuevos puntos y cerrá la zona.'
        : 'Tocá el mapa para marcar los vértices (mínimo 3). Doble clic o el primer punto para cerrar.',
    );
    setMapCursor('crosshair');
    // Mantener el encuadre de la zona actual para orientar.
    if (value) {
      requestAnimationFrame(() => fitToZone(value));
    }
  };

  const undoPoint = () => {
    setDraft((d) => d.slice(0, -1));
  };

  const closeZone = () => {
    finishDraft(draft);
  };

  const clearZone = () => {
    setDrawing(false);
    setDraft([]);
    cursorRef.current = null;
    setHint('Zona borrada.');
    setMapCursor('');
    onChange?.(null);
  };

  const cancelDraw = () => {
    setDrawing(false);
    setDraft([]);
    cursorRef.current = null;
    setHint(value ? 'Seguís con la zona anterior.' : '');
    setMapCursor('');
    requestAnimationFrame(() => {
      redraw();
      if (value) fitToZone(value);
    });
  };

  const hasZone = Boolean(value) && polyToLatLngs(value).length >= 3;
  const pinOk = pin ? (value ? puntoEnZona(value, pin) : true) : false;
  const heightCss = typeof height === 'number' ? `${height}px` : height;
  const vertexCount = hasZone && !drawing ? polyToLatLngs(value).length : draft.length;

  return (
    <div className={cn('space-y-2', className)}>
      <style dangerouslySetInnerHTML={{ __html: VERTEX_ICON_STYLE }} />
      <div
        className="relative overflow-hidden rounded-xl border bg-muted"
        style={{
          height: heightCss,
          minHeight: typeof height === 'number' ? height : 280,
        }}
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

        {ready && mode === 'edit' ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[min(100%-1.5rem,20rem)]">
            <div
              className={cn(
                'rounded-lg border bg-background/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm',
                drawing ? 'border-primary/40 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              {drawing ? (
                <span>
                  Dibujando · <strong className="text-foreground">{draft.length}</strong>
                  {draft.length < 3
                    ? ` / 3 pts mín.`
                    : ` pts · clic en 1 o doble clic para cerrar`}
                  {hasZone ? ' · zona anterior en tenue' : ''}
                </span>
              ) : hasZone ? (
                <span>
                  Zona activa · <strong className="text-foreground">{vertexCount}</strong> puntos
                </span>
              ) : (
                <span>Sin zona · tocá “Dibujar zona”</span>
              )}
            </div>
          </div>
        ) : null}

        {ready && mode === 'edit' && drawing && draft.length >= 3 ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2">
            <div className="rounded-full border border-primary/30 bg-background/95 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              Doble clic o tocá el punto 1 para cerrar
            </div>
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
                Deshacer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancelDraw}>
                <X className="size-3.5" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      ) : null}

      {mode === 'edit' && hasZone && !drawing ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <GripVertical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Arrastrá los puntos naranjas para ajustar. Doble clic en un punto para quitarlo (mín. 3).
        </p>
      ) : null}

      {mode === 'edit' && drawing ? (
        <p className="text-xs text-muted-foreground">
          Atajos: <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Esc</kbd> cancelar ·{' '}
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Enter</kbd> cerrar ·{' '}
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌫</kbd> deshacer punto
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

      {mode === 'view' && !hasZone ? (
        <p className="text-xs text-muted-foreground">El local aún no dibujó una zona en el mapa.</p>
      ) : null}

      {geoLabel ? <p className="text-xs text-muted-foreground">{geoLabel}</p> : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
