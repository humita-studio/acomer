// Modelo de dominio de reportes. Fuente única del tipo agregado que devuelve
// la query y consume la UI.

export type ReporteData = {
  resumen: {
    totalVentas: number;
    cantidadCobros: number;
    ticketPromedio: number;
    mesasAtendidas: number;
    tiempoPromedioOcupacionMin: number;
    /** Total descontado por promociones en el período. */
    totalDescuentos: number;
  };
  ventasPorDia: { fecha: string; total: number }[];
  ventasPorMetodo: { proveedor: string; total: number; cantidad: number }[];
  /** Top productos por unidades; `total` es la facturación NETA (descuento prorrateado). */
  topProductos: { nombre: string; cantidad: number; total: number }[];
  /** Promociones aplicadas: cuántas veces y cuánto descontaron en total. */
  promociones: { id: string; nombre: string; usos: number; descuento: number }[];
  ocupacionPorHora: { hora: number; sesiones: number }[];
};
