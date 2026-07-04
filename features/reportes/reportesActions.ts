'use server';

import { db } from '@/shared/db';
import { transaccionesPago, sesionesMesa } from '@/shared/db/schema';
import { and, eq, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import type { ReporteData } from './types';

const REPORTE_VACIO: ReporteData = {
  resumen: {
    totalVentas: 0,
    cantidadCobros: 0,
    ticketPromedio: 0,
    mesasAtendidas: 0,
    tiempoPromedioOcupacionMin: 0,
    totalDescuentos: 0,
  },
  ventasPorDia: [],
  ventasPorMetodo: [],
  topProductos: [],
  promociones: [],
  ocupacionPorHora: [],
};

const TZ = 'America/Argentina/Buenos_Aires';

/**
 * Reporte agregado sobre un rango de fechas (YYYY-MM-DD, inclusivo).
 * Las fronteras se calculan en horario de Buenos Aires.
 */
export async function getReporteAction(
  desde: string,
  hasta: string
): Promise<ReporteData> {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canViewReports')) {
    return REPORTE_VACIO;
  }
  const tenantId = session.restauranteId;
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
      topProductosRows,
      promocionesRows,
      ocupacionPorHora,
    ] = await Promise.all([
      // Resumen de ventas
      db
        .select({
          total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
          descuento: sql<string>`coalesce(sum(${transaccionesPago.descuento}), 0)`,
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
      // Top productos vendidos. `total` es la facturación NETA: el descuento de
      // cada sesión se prorratea entre sus ítems según el peso de cada línea, así
      // el reporte por producto refleja las promos (no el precio de lista).
      db.execute(sql`
        WITH mods AS (
          SELECT comanda_item_id, sum(precio_extra_snapshot) AS extra
          FROM comanda_item_modificadores
          WHERE restaurant_id = ${tenantId}
          GROUP BY comanda_item_id
        ),
        lineas AS (
          SELECT p.sesion_mesa_id AS sesion_id,
                 ci.nombre_producto_snapshot AS nombre,
                 ci.cantidad::numeric AS cantidad,
                 -- bruto = cantidad × (precio base + adicionales), igual que el subtotal
                 -- sobre el que se calculó el descuento al cobrar.
                 ci.cantidad::numeric * (ci.precio_unitario_snapshot + coalesce(m.extra, 0)) AS bruto
          FROM comanda_items ci
          JOIN pedidos p ON ci.pedido_id = p.id
          LEFT JOIN mods m ON m.comanda_item_id = ci.id
          WHERE ci.restaurant_id = ${tenantId}
            AND p.created_at >= ${desdeTs} AND p.created_at < ${hastaTs}
        ),
        desc_sesion AS (
          SELECT sesion_mesa_id, sum(descuento) AS descuento
          FROM transacciones_pago
          WHERE restaurant_id = ${tenantId}
            AND estado = 'Aprobado'
            AND created_at >= ${desdeTs} AND created_at < ${hastaTs}
          GROUP BY sesion_mesa_id
        ),
        bruto_sesion AS (
          SELECT sesion_id, sum(bruto) AS bruto FROM lineas GROUP BY sesion_id
        )
        SELECT l.nombre AS nombre,
               sum(l.cantidad)::int AS cantidad,
               coalesce(
                 sum(l.bruto * greatest(0, 1 - coalesce(d.descuento, 0) / nullif(b.bruto, 0))),
                 0
               ) AS total
        FROM lineas l
        JOIN bruto_sesion b ON b.sesion_id = l.sesion_id
        LEFT JOIN desc_sesion d ON d.sesion_mesa_id = l.sesion_id
        GROUP BY l.nombre
        ORDER BY sum(l.cantidad) DESC
        LIMIT 10
      `),
      // Promociones aplicadas en el período: se desarma el snapshot JSONB
      // (promociones_aplicadas) y se agrega por promo: cuántas veces y cuánto.
      db.execute(sql`
        SELECT elem->>'id' AS id,
               elem->>'nombre' AS nombre,
               count(*)::int AS usos,
               coalesce(sum((elem->>'descuento')::numeric), 0) AS descuento
        FROM transacciones_pago t,
             LATERAL jsonb_array_elements(t.promociones_aplicadas) AS elem
        WHERE t.restaurant_id = ${tenantId}
          AND t.estado = 'Aprobado'
          AND t.created_at >= ${desdeTs} AND t.created_at < ${hastaTs}
        GROUP BY elem->>'id', elem->>'nombre'
        ORDER BY descuento DESC
        LIMIT 20
      `),
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
        totalDescuentos: Number(ventasRow[0]?.descuento ?? 0),
      },
      ventasPorDia: ventasPorDia.map((r) => ({ fecha: r.fecha, total: Number(r.total) })),
      ventasPorMetodo: ventasPorMetodo.map((r) => ({
        proveedor: r.proveedor,
        total: Number(r.total),
        cantidad: r.cantidad,
      })),
      topProductos: (topProductosRows as Array<Record<string, unknown>>).map((r) => ({
        nombre: String(r.nombre),
        cantidad: Number(r.cantidad),
        total: Number(r.total),
      })),
      promociones: (promocionesRows as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        nombre: String(r.nombre),
        usos: Number(r.usos),
        descuento: Number(r.descuento),
      })),
      ocupacionPorHora: ocupacionPorHora.map((r) => ({ hora: r.hora, sesiones: r.sesiones })),
    };
  } catch (error) {
    console.error('[getReporteAction]', error);
    return REPORTE_VACIO;
  }
}
