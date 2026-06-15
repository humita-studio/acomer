'use server';

import { db } from '@/shared/db';
import { transaccionesPago, sesionesMesa, comandaItems, pedidos } from '@/shared/db/schema';
import { and, eq, sql, type AnyColumn, type SQL } from 'drizzle-orm';

export type ReporteData = {
  resumen: {
    totalVentas: number;
    cantidadCobros: number;
    ticketPromedio: number;
    mesasAtendidas: number;
    tiempoPromedioOcupacionMin: number;
  };
  ventasPorDia: { fecha: string; total: number }[];
  ventasPorMetodo: { proveedor: string; total: number; cantidad: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
  ocupacionPorHora: { hora: number; sesiones: number }[];
};

const REPORTE_VACIO: ReporteData = {
  resumen: {
    totalVentas: 0,
    cantidadCobros: 0,
    ticketPromedio: 0,
    mesasAtendidas: 0,
    tiempoPromedioOcupacionMin: 0,
  },
  ventasPorDia: [],
  ventasPorMetodo: [],
  topProductos: [],
  ocupacionPorHora: [],
};

const TZ = 'America/Argentina/Buenos_Aires';

/**
 * Reporte agregado sobre un rango de fechas (YYYY-MM-DD, inclusivo).
 * Las fronteras se calculan en horario de Buenos Aires.
 */
export async function getReporteAction(
  tenantId: string,
  desde: string,
  hasta: string
): Promise<ReporteData> {
  try {
    // Render the timezone as a literal, not a bind param: Drizzle would emit a
    // fresh parameter ($1, $7, $8…) for each ${TZ} interpolation, and Postgres
    // compares GROUP BY/ORDER BY expressions to the SELECT by parameter slot,
    // not by value — so the reused expression stops matching and triggers
    // "column must appear in the GROUP BY clause" (42803). TZ is a constant, so
    // injecting it as a literal is safe and keeps all clauses byte-identical.
    const tz = sql.raw(`'${TZ}'`);
    const desdeTs = sql`(${desde}::date) AT TIME ZONE ${tz}`;
    const hastaTs = sql`((${hasta}::date) + interval '1 day') AT TIME ZONE ${tz}`;
    const enRango = (col: AnyColumn): SQL =>
      sql`${col} >= ${desdeTs} AND ${col} < ${hastaTs}`;

    const fechaExpr = sql<string>`to_char(${transaccionesPago.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
    const horaExpr = sql<number>`extract(hour from ${sesionesMesa.createdAt} AT TIME ZONE ${tz})::int`;

    const [
      ventasRow,
      mesasRow,
      tiempoRow,
      ventasPorDia,
      ventasPorMetodo,
      topProductos,
      ocupacionPorHora,
    ] = await Promise.all([
      // Resumen de ventas
      db
        .select({
          total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
          cantidad: sql<number>`count(*)::int`,
        })
        .from(transaccionesPago)
        .where(
          and(
            eq(transaccionesPago.restauranteId, tenantId),
            eq(transaccionesPago.estado, 'Aprobado'),
            enRango(transaccionesPago.createdAt)
          )
        ),
      // Mesas atendidas (sesiones creadas en el rango)
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(sesionesMesa)
        .where(and(eq(sesionesMesa.restauranteId, tenantId), enRango(sesionesMesa.createdAt))),
      // Tiempo promedio de ocupación (sesiones cerradas)
      db
        .select({
          min: sql<string>`coalesce(avg(extract(epoch from (${sesionesMesa.updatedAt} - ${sesionesMesa.createdAt})) / 60), 0)`,
        })
        .from(sesionesMesa)
        .where(
          and(
            eq(sesionesMesa.restauranteId, tenantId),
            eq(sesionesMesa.estado, 'Cerrada'),
            enRango(sesionesMesa.createdAt)
          )
        ),
      // Ventas por día
      db
        .select({
          fecha: fechaExpr,
          total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
        })
        .from(transaccionesPago)
        .where(
          and(
            eq(transaccionesPago.restauranteId, tenantId),
            eq(transaccionesPago.estado, 'Aprobado'),
            enRango(transaccionesPago.createdAt)
          )
        )
        .groupBy(fechaExpr)
        .orderBy(fechaExpr),
      // Ventas por método de pago
      db
        .select({
          proveedor: transaccionesPago.proveedor,
          total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
          cantidad: sql<number>`count(*)::int`,
        })
        .from(transaccionesPago)
        .where(
          and(
            eq(transaccionesPago.restauranteId, tenantId),
            eq(transaccionesPago.estado, 'Aprobado'),
            enRango(transaccionesPago.createdAt)
          )
        )
        .groupBy(transaccionesPago.proveedor),
      // Top productos vendidos
      db
        .select({
          nombre: comandaItems.nombreProductoSnapshot,
          cantidad: sql<number>`coalesce(sum(${comandaItems.cantidad}), 0)::int`,
          total: sql<string>`coalesce(sum(${comandaItems.cantidad} * ${comandaItems.precioUnitarioSnapshot}), 0)`,
        })
        .from(comandaItems)
        .innerJoin(pedidos, eq(comandaItems.pedidoId, pedidos.id))
        .where(and(eq(comandaItems.restauranteId, tenantId), enRango(pedidos.createdAt)))
        .groupBy(comandaItems.nombreProductoSnapshot)
        .orderBy(sql`sum(${comandaItems.cantidad}) desc`)
        .limit(10),
      // Ocupación por hora del día
      db
        .select({ hora: horaExpr, sesiones: sql<number>`count(*)::int` })
        .from(sesionesMesa)
        .where(and(eq(sesionesMesa.restauranteId, tenantId), enRango(sesionesMesa.createdAt)))
        .groupBy(horaExpr)
        .orderBy(horaExpr),
    ]);

    const totalVentas = Number(ventasRow[0]?.total ?? 0);
    const cantidadCobros = ventasRow[0]?.cantidad ?? 0;

    return {
      resumen: {
        totalVentas,
        cantidadCobros,
        ticketPromedio: cantidadCobros > 0 ? totalVentas / cantidadCobros : 0,
        mesasAtendidas: mesasRow[0]?.c ?? 0,
        tiempoPromedioOcupacionMin: Math.round(Number(tiempoRow[0]?.min ?? 0)),
      },
      ventasPorDia: ventasPorDia.map((r) => ({ fecha: r.fecha, total: Number(r.total) })),
      ventasPorMetodo: ventasPorMetodo.map((r) => ({
        proveedor: r.proveedor,
        total: Number(r.total),
        cantidad: r.cantidad,
      })),
      topProductos: topProductos.map((r) => ({
        nombre: r.nombre,
        cantidad: r.cantidad,
        total: Number(r.total),
      })),
      ocupacionPorHora: ocupacionPorHora.map((r) => ({ hora: r.hora, sesiones: r.sesiones })),
    };
  } catch (error) {
    console.error('[getReporteAction]', error);
    return REPORTE_VACIO;
  }
}
