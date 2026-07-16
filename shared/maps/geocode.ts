'use server';

import type { LatLng } from './zonaMapa';

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
      headers: {
        // Nominatim pide un User-Agent identificable.
        'User-Agent': 'acomer-delivery-zone/1.0 (https://acomer.com.ar)',
        Accept: 'application/json',
        'Accept-Language': 'es',
      },
      // Cache 24h: la dirección del local casi no cambia.
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      console.warn('[geocodeDireccionAction] HTTP', res.status);
      return null;
    }

    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = data?.[0];
    if (!hit?.lat || !hit?.lon) return null;

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    };
  } catch (error) {
    console.warn('[geocodeDireccionAction]', error);
    return null;
  }
}
