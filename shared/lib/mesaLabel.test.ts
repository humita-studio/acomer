import { describe, expect, it } from 'vitest';
import { etiquetaMesa, etiquetaOrigenSesion } from './mesaLabel';

describe('etiquetaMesa', () => {
  it('antepone "Mesa" a identificadores numéricos o cortos', () => {
    expect(etiquetaMesa('12')).toBe('Mesa 12');
    expect(etiquetaMesa('A3')).toBe('Mesa A3');
    expect(etiquetaMesa('  7 ')).toBe('Mesa 7');
  });

  it('no duplica el prefijo cuando el nombre ya lo trae', () => {
    expect(etiquetaMesa('Mesa 12')).toBe('Mesa 12');
    expect(etiquetaMesa('MESA 3')).toBe('MESA 3');
    expect(etiquetaMesa('mesa 5')).toBe('mesa 5');
  });

  it('respeta nombres propios de sectores', () => {
    expect(etiquetaMesa('Barra 2')).toBe('Barra 2');
    expect(etiquetaMesa('Terraza 1')).toBe('Terraza 1');
    expect(etiquetaMesa('Box VIP')).toBe('Box VIP');
  });

  it('cae a "Mesa" si no hay identificador', () => {
    expect(etiquetaMesa('')).toBe('Mesa');
    expect(etiquetaMesa(null)).toBe('Mesa');
    expect(etiquetaMesa(undefined)).toBe('Mesa');
  });
});

describe('etiquetaOrigenSesion', () => {
  it('usa el nombre de la mesa cuando la sesión es de salón', () => {
    expect(etiquetaOrigenSesion({ tipo: 'salon', mesa: { identificador: '12' } })).toBe('Mesa 12');
    expect(etiquetaOrigenSesion({ tipo: 'salon', mesa: { identificador: 'Mesa 12' } })).toBe('Mesa 12');
  });

  it('describe el canal cuando no hay mesa física', () => {
    expect(etiquetaOrigenSesion({ tipo: 'takeaway', mesa: null })).toBe('Retiro en local');
    expect(etiquetaOrigenSesion({ tipo: 'delivery' })).toBe('Delivery');
    expect(etiquetaOrigenSesion({ tipo: 'mostrador' })).toBe('Mostrador');
  });

  it('nunca muestra un UUID ni "Desconocida"', () => {
    expect(etiquetaOrigenSesion(null)).toBe('Sin mesa');
    expect(etiquetaOrigenSesion({ tipo: 'otro' })).toBe('Sin mesa');
  });
});
