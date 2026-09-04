import { describe, expect, it } from 'vitest';
import { calcularMetricasResenas, esDerivableAGoogle } from './resenasCore';
import type { ResenaClienteDto } from './types';

describe('esDerivableAGoogle', () => {
  it('deriva 4 y 5 estrellas por defecto', () => {
    expect(esDerivableAGoogle(5)).toBe(true);
    expect(esDerivableAGoogle(4)).toBe(true);
    expect(esDerivableAGoogle(3)).toBe(false);
    expect(esDerivableAGoogle(2)).toBe(false);
    expect(esDerivableAGoogle(1)).toBe(false);
  });

  it('respeta un umbral personalizado', () => {
    expect(esDerivableAGoogle(5, 5)).toBe(true);
    expect(esDerivableAGoogle(4, 5)).toBe(false);
  });
});

describe('calcularMetricasResenas', () => {
  it('devuelve ceros cuando la lista está vacía', () => {
    const res = calcularMetricasResenas([]);
    expect(res.total).toBe(0);
    expect(res.promedio).toBe(0);
    expect(res.topAspectos).toEqual([]);
  });

  it('calcula promedio y distribución correctamente', () => {
    const mockResenas: ResenaClienteDto[] = [
      {
        id: '1',
        origen: 'mesa',
        mesaId: null,
        pedidoId: null,
        identificadorMesa: 'Mesa 1',
        estrellas: 5,
        aspectos: [],
        comentario: null,
        contactoNombre: null,
        contactoTelefono: null,
        derivadaAGoogle: true,
        estado: 'nuevo',
        createdAt: new Date(),
      },
      {
        id: '2',
        origen: 'mesa',
        mesaId: null,
        pedidoId: null,
        identificadorMesa: 'Mesa 2',
        estrellas: 1,
        aspectos: ['demora', 'comida_fria'],
        comentario: 'Tardó 50 minutos',
        contactoNombre: 'Juan',
        contactoTelefono: '1122334455',
        derivadaAGoogle: false,
        estado: 'nuevo',
        createdAt: new Date(),
      },
      {
        id: '3',
        origen: 'delivery',
        mesaId: null,
        pedidoId: null,
        identificadorMesa: null,
        estrellas: 2,
        aspectos: ['demora'],
        comentario: null,
        contactoNombre: null,
        contactoTelefono: null,
        derivadaAGoogle: false,
        estado: 'nuevo',
        createdAt: new Date(),
      },
    ];

    const stats = calcularMetricasResenas(mockResenas);
    expect(stats.total).toBe(3);
    // (5 + 1 + 2) / 3 = 2.67 -> 2.7
    expect(stats.promedio).toBe(2.7);
    expect(stats.derivadasGoogle).toBe(1);
    expect(stats.privadasNegativas).toBe(2);
    expect(stats.distribucionEstrellas[5]).toBe(1);
    expect(stats.distribucionEstrellas[1]).toBe(1);
    expect(stats.distribucionEstrellas[2]).toBe(1);

    // Top aspectos
    expect(stats.topAspectos[0]).toEqual({
      aspecto: 'demora',
      label: 'Demora en la comida',
      count: 2,
    });
    expect(stats.topAspectos[1]).toEqual({
      aspecto: 'comida_fria',
      label: 'Comida fría o plato incorrecto',
      count: 1,
    });
  });
});
