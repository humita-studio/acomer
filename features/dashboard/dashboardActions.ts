'use server';

import { db } from '@/shared/db';
import { mesas, sesionesMesa, transaccionesPago, pedidos } from '@/shared/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

export type DashboardMetrics = {
  ocupacion: { mesasOcupadas: number; totalMesas: number; porcentaje: number };
  ventasHoy: { total: number; cantidadCobros: number; ticketPromedio: number };
  pedidosActivos: { pendiente: number; enPreparacion: number; listo: number; total: number };
};

const METRICS_VACIAS: DashboardMetrics = {
  ocupacion: { mesasOcupadas: 0, totalMesas: 0, porcentaje: 0 },
  ventasHoy: { total: 0, cantidadCobros: 0, ticketPromedio: 0 },
  pedidosActivos: { pendiente: 0, enPreparacion: 0, listo: 0, total: 0 },
};

// Inicio del día actual en horario de Buenos Aires, como instante (timestamptz).
const INICIO_HOY = sql`(date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')) AT TIME ZONE 'America/Argentina/Buenos_Aires'`;

export async function getDashboardMetricsAction(tenantId: string): Promise<DashboardMetrics> {
  try {
    const [totalMesasRow, ocupadasRow, ventasRow, pedidosRows] = await Promise.all([
      // Total de mesas reales (no sub-mesas, no eliminadas)
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(mesas)
        .where(
          and(eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt), isNull(mesas.parentMesaId))
        ),
      // Mesas con sesión activa
      db
        .select({ c: sql<number>`count(distinct ${sesionesMesa.mesaId})::int` })
        .from(sesionesMesa)
        .where(and(eq(sesionesMesa.restauranteId, tenantId), eq(sesionesMesa.estado, 'Activa'))),
      // Ventas aprobadas de hoy
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
            sql`${transaccionesPago.createdAt} >= ${INICIO_HOY}`
          )
        ),
      // Pedidos activos agrupados por estado
      db
        .select({ estado: pedidos.estado, c: sql<number>`count(*)::int` })
        .from(pedidos)
        .where(
          and(
            eq(pedidos.restauranteId, tenantId),
            inArray(pedidos.estado, ['Pendiente', 'En Preparación', 'Listo'])
          )
        )
        .groupBy(pedidos.estado),
    ]);

    const totalMesas = totalMesasRow[0]?.c ?? 0;
    const mesasOcupadas = ocupadasRow[0]?.c ?? 0;
    const porcentaje = totalMesas > 0 ? Math.round((mesasOcupadas / totalMesas) * 100) : 0;

    const total = Number(ventasRow[0]?.total ?? 0);
    const cantidadCobros = ventasRow[0]?.cantidad ?? 0;
    const ticketPromedio = cantidadCobros > 0 ? total / cantidadCobros : 0;

    const porEstado = new Map(pedidosRows.map((r) => [r.estado, r.c]));
    const pendiente = porEstado.get('Pendiente') ?? 0;
    const enPreparacion = porEstado.get('En Preparación') ?? 0;
    const listo = porEstado.get('Listo') ?? 0;

    return {
      ocupacion: { mesasOcupadas, totalMesas, porcentaje },
      ventasHoy: { total, cantidadCobros, ticketPromedio },
      pedidosActivos: { pendiente, enPreparacion, listo, total: pendiente + enPreparacion + listo },
    };
  } catch (error) {
    console.error('[getDashboardMetricsAction]', error);
    return METRICS_VACIAS;
  }
}
