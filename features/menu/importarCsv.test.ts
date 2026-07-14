import { describe, expect, it } from 'vitest';
import { parseMenuCsv, splitCsvLine } from './importarCsv';

describe('splitCsvLine', () => {
  it('parte por comas', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('respeta comillas', () => {
    expect(splitCsvLine('Empanada,"Cortada, frita",Entradas,1200,si')).toEqual([
      'Empanada',
      'Cortada, frita',
      'Entradas',
      '1200',
      'si',
    ]);
  });
});

describe('parseMenuCsv', () => {
  const sample = `nombre,descripcion,categoria,precio,disponible
Empanada de carne,Cortada a cuchillo,Entradas,1200,si
Milanesa,,Principales,6800,si
Sin precio,desc,Bebidas,,si
`;

  it('parsea filas válidas y saltea precio vacío', () => {
    const r = parseMenuCsv(sample);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0].nombre).toBe('Empanada de carne');
    expect(r.filas[0].precio).toBe(1200);
    expect(r.filas[1].disponible).toBe(true);
  });

  it('exige encabezados de la plantilla', () => {
    const r = parseMenuCsv('foo,bar\n1,2');
    expect(r.ok).toBe(false);
  });

  it('tolera BOM y disponible=no', () => {
    const r = parseMenuCsv(
      '\uFEFFnombre,descripcion,categoria,precio,disponible\nCoca,,Bebidas,1500,no\n',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0].disponible).toBe(false);
  });
});
