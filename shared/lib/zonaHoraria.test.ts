import { describe, expect, it } from 'vitest';
import { inicioDelDiaEnZona, instanteEnZona, partesEnZona } from './zonaHoraria';

describe('zona horaria del local', () => {
  it('21:00 de Buenos Aires es 00:00 UTC del día siguiente', () => {
    expect(instanteEnZona('2026-09-04', '21:00').toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });

  it('vuelve al mismo reloj de pared desde el instante', () => {
    const d = instanteEnZona('2026-09-04', '21:00');
    expect(partesEnZona(d)).toEqual({ ymd: '2026-09-04', hhmm: '21:00', dow: 5 });
  });

  it('no depende de la zona del proceso', () => {
    // 2026-09-05T02:30Z = 23:30 del 4 en Buenos Aires (UTC-3).
    const d = new Date('2026-09-05T02:30:00.000Z');
    expect(partesEnZona(d).ymd).toBe('2026-09-04');
    expect(partesEnZona(d).hhmm).toBe('23:30');
  });

  it('inicio del día local en UTC', () => {
    const d = new Date('2026-09-05T02:30:00.000Z');
    expect(inicioDelDiaEnZona(d).toISOString()).toBe('2026-09-04T03:00:00.000Z');
  });

  it('otras zonas: 12:00 en Madrid (verano) es 10:00Z', () => {
    expect(instanteEnZona('2026-07-01', '12:00', 'Europe/Madrid').toISOString()).toBe(
      '2026-07-01T10:00:00.000Z',
    );
  });
});
