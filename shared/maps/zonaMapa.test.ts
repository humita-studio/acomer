import { describe, expect, it } from 'vitest';
import {
  latLngsToPolygon,
  puntoEnZona,
  sanearZonaPoligono,
  centroidePoligono,
  ringToLatLngs,
} from './zonaMapa';

/** Cuadrado alrededor de Palermo (aprox). */
const PALERMO = latLngsToPolygon([
  { lat: -34.575, lng: -58.435 },
  { lat: -34.575, lng: -58.405 },
  { lat: -34.595, lng: -58.405 },
  { lat: -34.595, lng: -58.435 },
])!;

describe('latLngsToPolygon / sanearZonaPoligono', () => {
  it('arma un polígono cerrado válido', () => {
    expect(PALERMO.type).toBe('Polygon');
    const ring = PALERMO.coordinates[0];
    expect(ring.length).toBe(5); // 4 + cierre
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('rechaza menos de 3 puntos', () => {
    expect(latLngsToPolygon([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }])).toBeNull();
  });

  it('sanea basura y acepta polígono válido', () => {
    expect(sanearZonaPoligono(null)).toBeNull();
    expect(sanearZonaPoligono({ type: 'Point' })).toBeNull();
    expect(sanearZonaPoligono(PALERMO)).not.toBeNull();
  });
});

describe('puntoEnZona', () => {
  it('punto interior está adentro', () => {
    expect(puntoEnZona(PALERMO, { lat: -34.585, lng: -58.42 })).toBe(true);
  });

  it('punto exterior está afuera', () => {
    expect(puntoEnZona(PALERMO, { lat: -34.62, lng: -58.45 })).toBe(false);
  });

  it('sin polígono → false', () => {
    expect(puntoEnZona(null, { lat: -34.585, lng: -58.42 })).toBe(false);
  });
});

describe('centroide / ring', () => {
  it('centroide cae dentro del cuadrado', () => {
    const c = centroidePoligono(PALERMO)!;
    expect(puntoEnZona(PALERMO, c)).toBe(true);
  });

  it('ringToLatLngs quita el cierre', () => {
    const pts = ringToLatLngs(PALERMO.coordinates[0]);
    expect(pts.length).toBe(4);
  });
});
