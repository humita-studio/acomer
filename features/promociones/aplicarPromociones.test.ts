import { describe, expect, it } from 'vitest';
import { aplicarPromociones, type PromoItem } from './aplicarPromociones';
import type { Promocion } from './promociones';

const basePromo = (over: Partial<Promocion> & Pick<Promocion, 'id' | 'nombre' | 'tipo'>): Promocion => ({
  valor: 0,
  alcance: 'pedido',
  targetIds: [],
  condiciones: {},
  vigenteDesde: null,
  vigenteHasta: null,
  activa: true,
  prioridad: 10,
  ...over,
});

const items: PromoItem[] = [
  {
    productoId: 'prod-a',
    categoriaId: 'cat-1',
    cantidad: 2,
    precioUnitario: 1000,
    subtotal: 2000,
  },
  {
    productoId: 'prod-b',
    categoriaId: 'cat-1',
    cantidad: 1,
    precioUnitario: 500,
    subtotal: 500,
  },
];

describe('aplicarPromociones', () => {
  it('porcentaje sobre pedido completo', () => {
    const r = aplicarPromociones(items, [
      basePromo({ id: '1', nombre: '10%', tipo: 'porcentaje', valor: 10 }),
    ]);
    expect(r.subtotal).toBe(2500);
    expect(r.descuento).toBe(250);
    expect(r.total).toBe(2250);
  });

  it('monto fijo no supera el subtotal', () => {
    const r = aplicarPromociones(items, [
      basePromo({ id: '1', nombre: 'fijo', tipo: 'monto_fijo', valor: 99999 }),
    ]);
    expect(r.descuento).toBe(2500);
    expect(r.total).toBe(0);
  });

  it('2x1 regala la mitad de unidades por línea', () => {
    const r = aplicarPromociones(items, [
      basePromo({
        id: '1',
        nombre: '2x1',
        tipo: '2x1',
        alcance: 'producto',
        targetIds: ['prod-a'],
      }),
    ]);
    // floor(2/2)*1000 = 1000
    expect(r.descuento).toBe(1000);
  });

  it('respeta soloEfectivo', () => {
    const promo = basePromo({
      id: '1',
      nombre: 'cash',
      tipo: 'porcentaje',
      valor: 20,
      condiciones: { soloEfectivo: true },
    });
    const sin = aplicarPromociones(items, [promo], { metodoPago: 'tarjeta' });
    const con = aplicarPromociones(items, [promo], { metodoPago: 'efectivo' });
    expect(sin.descuento).toBe(0);
    expect(con.descuento).toBe(500);
  });

  it('omite promos en omitirIds', () => {
    const r = aplicarPromociones(
      items,
      [basePromo({ id: '1', nombre: '10%', tipo: 'porcentaje', valor: 10 })],
      { omitirIds: ['1'] },
    );
    expect(r.descuento).toBe(0);
  });
});
