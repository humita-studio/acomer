'use server';

import type { LatLng } from './zonaMapa';

const NOMINATIM_HEADERS = {
  // Nominatim pide un User-Agent identificable.
  'User-Agent': 'acomer-delivery-zone/1.0 (https://acomer.com.ar)',
  Accept: 'application/json',
  'Accept-Language': 'es',
} as const;

function roundCoord(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

function parseLatLng(latRaw: unknown, lonRaw: unknown): LatLng | null {
  const lat = Number(latRaw);
  const lng = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

/**
 * Geocodifica una dirección con Nominatim (OSM). Sesgo a Argentina.
 * Cacheable vía fetch next.revalidate. Devuelve null si no encuentra.
 */
export async function geocodeDireccionAction(direccion: string): Promise<LatLng | null> {
  const raw = (direccion ?? '').trim();
  if (raw.length < 4 || raw.length > 300) return null;

  const q = /argentina|buenos aires|caba|córdoba|cordoba|rosario|mendoza/i.test(raw)
    ? raw
    : `${raw}, Argentina`;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', q);
    url.searchParams.set('countrycodes', 'ar');

    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      // Cache 24h: direcciones estables.
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      console.warn('[geocodeDireccionAction] HTTP', res.status);
      return null;
    }

    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = data?.[0];
    if (!hit) return null;
    return parseLatLng(hit.lat, hit.lon);
  } catch (error) {
    console.warn('[geocodeDireccionAction]', error);
    return null;
  }
}

/**
 * Reverse geocode: lat/lng → dirección legible (calle y número si hay).
 * Sesgo a es-AR. Devuelve null si no encuentra.
 */
export async function reverseGeocodeAction(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      console.warn('[reverseGeocodeAction] HTTP', res.status);
      return null;
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        pedestrian?: string;
        footway?: string;
        path?: string;
        house_number?: string;
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
      };
    };

    const a = data.address;
    if (a) {
      const street = a.road || a.pedestrian || a.footway || a.path;
      const parts: string[] = [];
      if (street) {
        parts.push(a.house_number ? `${street} ${a.house_number}` : street);
      }
      const barrio = a.suburb || a.neighbourhood;
      if (barrio) parts.push(barrio);
      const ciudad = a.city || a.town || a.village;
      if (ciudad) parts.push(ciudad);
      if (parts.length > 0) {
        const txt = parts.join(', ').trim();
        if (txt.length >= 4 && txt.length <= 300) return txt;
      }
    }

    const fallback = (data.display_name ?? '').trim();
    if (fallback.length >= 4 && fallback.length <= 300) {
      // Recortar display_name muy largo (país, etc.).
      return fallback.split(',').slice(0, 4).join(',').trim();
    }
    return null;
  } catch (error) {
    console.warn('[reverseGeocodeAction]', error);
    return null;
  }
}
