/**
 * Tipos y helpers puros para la zona de entrega en mapa (GeoJSON Polygon).
 * Sin deps de Leaflet — usable en server actions y tests.
 */

/** Centro por defecto: CABA. */
export const MAPA_DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 } as const;
export const MAPA_DEFAULT_ZOOM = 13;

/** Vértices máximos de un polígono de zona (evita payloads enormes). */
export const ZONA_MAX_VERTICES = 64;

export type LatLng = { lat: number; lng: number };

/** GeoJSON Polygon (coordenadas [lng, lat]). */
export type ZonaPoligono = {
  type: 'Polygon';
  coordinates: number[][][];
};

export function isLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.lat === 'number' &&
    typeof o.lng === 'number' &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng) &&
    o.lat >= -90 &&
    o.lat <= 90 &&
    o.lng >= -180 &&
    o.lng <= 180
  );
}

/** Ring cerrado en [lng, lat] → lista de puntos lat/lng (sin repetir el cierre). */
export function ringToLatLngs(ring: number[][]): LatLng[] {
  if (!Array.isArray(ring) || ring.length < 3) return [];
  const pts: LatLng[] = [];
  for (const c of ring) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    pts.push({ lat, lng });
  }
  // Quitar el vértice de cierre si es igual al primero.
  if (pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9) {
      pts.pop();
    }
  }
  return pts;
}

/** Lista de puntos → GeoJSON Polygon cerrado. */
export function latLngsToPolygon(points: LatLng[]): ZonaPoligono | null {
  if (points.length < 3 || points.length > ZONA_MAX_VERTICES) return null;
  for (const p of points) {
    if (!isLatLng(p)) return null;
  }
  const ring = points.map((p) => [
    Math.round(p.lng * 1e6) / 1e6,
    Math.round(p.lat * 1e6) / 1e6,
  ]);
  // Cerrar el anillo.
  ring.push([...ring[0]]);
  return { type: 'Polygon', coordinates: [ring] };
}

/**
 * Valida y normaliza un GeoJSON Polygon. Devuelve null si es inválido.
 */
export function sanearZonaPoligono(raw: unknown): ZonaPoligono | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== 'Polygon' || !Array.isArray(o.coordinates)) return null;
  const rings = o.coordinates as unknown[];
  if (rings.length < 1 || !Array.isArray(rings[0])) return null;
  const pts = ringToLatLngs(rings[0] as number[][]);
  return latLngsToPolygon(pts);
}

/** Centroide aproximado (promedio de vértices). */
export function centroidePoligono(poly: ZonaPoligono | null | undefined): LatLng | null {
  if (!poly) return null;
  const pts = ringToLatLngs(poly.coordinates[0] ?? []);
  if (pts.length === 0) return null;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return { lat, lng };
}

/** Bounds [[south, west], [north, east]] para fitBounds de Leaflet. */
export function boundsPoligono(
  poly: ZonaPoligono | null | undefined,
): [[number, number], [number, number]] | null {
  if (!poly) return null;
  const pts = ringToLatLngs(poly.coordinates[0] ?? []);
  if (pts.length === 0) return null;
  let minLat = pts[0].lat;
  let maxLat = pts[0].lat;
  let minLng = pts[0].lng;
  let maxLng = pts[0].lng;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Ray-casting point-in-polygon. `poly` en GeoJSON [lng,lat].
 * Borde cuenta como adentro (epsilon suave).
 */
export function puntoEnZona(poly: ZonaPoligono | null | undefined, point: LatLng): boolean {
  if (!poly || !isLatLng(point)) return false;
  const pts = ringToLatLngs(poly.coordinates[0] ?? []);
  if (pts.length < 3) return false;

  const x = point.lng;
  const y = point.lat;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].lng;
    const yi = pts[i].lat;
    const xj = pts[j].lng;
    const yj = pts[j].lat;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
