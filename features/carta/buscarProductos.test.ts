import { describe, expect, it } from 'vitest';
import { filtrarProductosPorBusqueda, normalizarBusqueda } from './buscarProductos';

const menu = [
  { nombre: 'Milanesa napolitana', descripcion: 'Con jamón y queso' },
  { nombre: 'Café con leche', descripcion: 'Caliente' },
  { nombre: 'Ensalada César', descripcion: 'Lechuga, pollo y crutones' },
  { nombre: 'Papas fritas', descripcion: null },
  { nombre: 'Hamburguesa clásica', descripcion: 'Doble carne' },
];

describe('normalizarBusqueda', () => {
  it('saca tildes y pasa a minúsculas', () => {
    expect(normalizarBusqueda('Café')).toBe('cafe');
  });
});

describe('filtrarProductosPorBusqueda', () => {
  it('encuentra por substring en nombre', () => {
    const r = filtrarProductosPorBusqueda(menu, 'mila');
    expect(r.map((p) => p.nombre)).toEqual(['Milanesa napolitana']);
  });

  it('respeta tildes: "cafe" encuentra "Café"', () => {
    const r = filtrarProductosPorBusqueda(menu, 'cafe');
    expect(r.map((p) => p.nombre)).toEqual(['Café con leche']);
  });

  it('exige todas las palabras', () => {
    const r = filtrarProductosPorBusqueda(menu, 'milanesa napolitana');
    expect(r.map((p) => p.nombre)).toEqual(['Milanesa napolitana']);
  });

  it('no inventa resultados con texto random', () => {
    expect(filtrarProductosPorBusqueda(menu, 'xyzabc')).toEqual([]);
    expect(filtrarProductosPorBusqueda(menu, 'avion espacial')).toEqual([]);
    expect(filtrarProductosPorBusqueda(menu, 'asdfgh')).toEqual([]);
  });

  it('tolera un typo leve en el nombre', () => {
    const r = filtrarProductosPorBusqueda(menu, 'milansea');
    expect(r.map((p) => p.nombre)).toContain('Milanesa napolitana');
  });

  it('con 1–2 chars solo busca en el nombre', () => {
    // "po" está en "pollo" de la descripción de César, pero no debe matchear.
    const r = filtrarProductosPorBusqueda(menu, 'po');
    expect(r.map((p) => p.nombre)).not.toContain('Ensalada César');
  });
});
