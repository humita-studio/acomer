/**
 * Serializa un reporte a CSV (UTF-8 con BOM para Excel).
 * Puro: sin I/O — testeable y usable en server o client.
 */
import type { ReporteData } from './types';

function esc(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reporteToCsv(data: ReporteData, desde: string, hasta: string): string {
  const lines: string[] = [];
  lines.push(`Reporte acomer,${esc(desde)},${esc(hasta)}`);
  lines.push('');
  lines.push('Resumen');
  lines.push('metrica,valor');
  lines.push(`ventas_totales,${data.resumen.totalVentas}`);
  lines.push(`cantidad_cobros,${data.resumen.cantidadCobros}`);
  lines.push(`ticket_promedio,${data.resumen.ticketPromedio}`);
  lines.push(`mesas_atendidas,${data.resumen.mesasAtendidas}`);
  lines.push(`ocupacion_promedio_min,${data.resumen.tiempoPromedioOcupacionMin}`);
  lines.push(`total_descuentos,${data.resumen.totalDescuentos}`);
  lines.push('');
  lines.push('Ventas por dia');
  lines.push('fecha,total');
  for (const r of data.ventasPorDia) {
    lines.push(`${esc(r.fecha)},${r.total}`);
  }
  lines.push('');
  lines.push('Ventas por metodo');
  lines.push('metodo,total,cantidad');
  for (const r of data.ventasPorMetodo) {
    lines.push(`${esc(r.proveedor)},${r.total},${r.cantidad}`);
  }
  lines.push('');
  lines.push('Top productos');
  lines.push('nombre,cantidad,total');
  for (const r of data.topProductos) {
    lines.push(`${esc(r.nombre)},${r.cantidad},${r.total}`);
  }
  lines.push('');
  lines.push('Promociones');
  lines.push('nombre,usos,descuento');
  for (const r of data.promociones) {
    lines.push(`${esc(r.nombre)},${r.usos},${r.descuento}`);
  }
  // BOM para que Excel abra bien UTF-8
  return `\uFEFF${lines.join('\n')}`;
}
