import { describe, expect, it } from 'vitest';
import { reporteToCsv } from './exportCsv';
import type { ReporteData } from './types';

const sample: ReporteData = {
  resumen: {
    totalVentas: 1000,
    cantidadCobros: 2,
    ticketPromedio: 500,
    mesasAtendidas: 1,
    tiempoPromedioOcupacionMin: 40,
    totalDescuentos: 50,
  },
  ventasPorDia: [{ fecha: '2026-07-01', total: 1000 }],
  ventasPorMetodo: [{ proveedor: 'efectivo', total: 1000, cantidad: 2 }],
  topProductos: [{ nombre: 'Milanesa, con papas', cantidad: 2, total: 900 }],
  promociones: [{ id: '1', nombre: 'Happy hour', usos: 1, descuento: 50 }],
  ocupacionPorHora: [],
};

describe('reporteToCsv', () => {
  it('incluye BOM y escapa comas en nombres', () => {
    const csv = reporteToCsv(sample, '2026-07-01', '2026-07-01');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('ventas_totales,1000');
    expect(csv).toContain('"Milanesa, con papas",2,900');
  });
});
