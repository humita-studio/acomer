import { describe, expect, it } from 'vitest';
import { esItemLibre } from './item-libre';

describe('esItemLibre', () => {
  it('true cuando no hay producto y hay nombre', () => {
    expect(
      esItemLibre({
        productoId: null,
        nombreLibre: '  Empanada casera  ',
        precioLibre: 500,
      }),
    ).toBe(true);
  });

  it('false si hay productoId', () => {
    expect(
      esItemLibre({
        productoId: 'uuid',
        nombreLibre: 'x',
        precioLibre: 1,
      }),
    ).toBe(false);
  });

  it('false si nombre vacío', () => {
    expect(
      esItemLibre({
        productoId: null,
        nombreLibre: '   ',
        precioLibre: 100,
      }),
    ).toBe(false);
  });
});
