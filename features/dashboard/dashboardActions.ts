'use server';

import { db } from '@/shared/db';
import { mesas, sesionesMesa, transaccionesPago, pedidos, comandaItems, reservas } from '@/shared/db/schema';
import { and, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';

import type {
  CanalPedido,
  DashboardMetrics,
  PedidoReciente,
  Periodo,
  PuntoSerie,
  SerieModo,
} from './types';

function metricasVacias(periodo: Periodo): DashboardMetrics {
  return {
    periodo,
    ocupacion: { mesasOcupadas: 0, totalMesas: 0, porcentaje: 0 },
    ventas: { total: 0, cantidadCobros: 0, ticketPromedio: 0, deltaTotalPct: null, deltaTicketPct: null },
    pedidos: { total: 0, deltaPct: null },
    salon: { ocupadas: 0, reservadas: 0, libres: 0, total: 0 },
    serie: { modo: periodo === 'hoy' ? 'hora' : 'dia', puntos: [] },
    pedidosRecientes: [],
  };
}

const TZ = 'America/Argentina/Buenos_Aires';

// Inicio del día actual en horario de Buenos Aires, como instante (timestamptz).
const INICIO_HOY = sql`(date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')) AT TIME ZONE 'America/Argentina/Buenos_Aires'`;
const FIN_HOY = sql`${INICIO_HOY} + interval '1 day'`;

type Ventana = {
  inicio: SQL;
  prevInicio: SQL;
  prevCorte: SQL;
  modo: SerieModo;
  dias: number;
};

// Ventana del período + ventana previa comparable (mismo largo, mismo momento transcurrido).
function ventanaPeriodo(periodo: Periodo): Ventana {
  switch (periodo) {
    case 'semana':
      return {
        inicio: sql`${INICIO_HOY} - interval '6 days'`,
        prevInicio: sql`${INICIO_HOY} - interval '13 days'`,
        prevCorte: sql`now() - interval '7 days'`,
        modo: 'dia',
        dias: 7,
      };
    case 'mes':
      return {
        inicio: sql`${INICIO_HOY} - interval '29 days'`,
        prevInicio: sql`${INICIO_HOY} - interval '59 days'`,
        prevCorte: sql`now() - interval '30 days'`,
        modo: 'dia',
        dias: 30,
      };
    default:
      return {
        inicio: INICIO_HOY,
        prevInicio: sql`${INICIO_HOY} - interval '1 day'`,
        prevCorte: sql`now() - interval '1 day'`,
        modo: 'hora',
        dias: 1,
      };
  }
}

/** Variación porcentual período vs período previo; null cuando el previo no tuvo movimiento. */
function variacionPct(actual: number, previo: number): number | null {
  if (previo <= 0) return null;
  return ((actual - previo) / previo) * 100;
}

function canalDesdeTipo(tipo: string | null, mesaLabel: string | null): { canal: CanalPedido; canalLabel: string } {
  switch (tipo) {
    case 'salon':
      if (!mesaLabel) return { canal: 'salon', canalLabel: 'Salón' };
      return { canal: 'salon', canalLabel: /^\d+$/.test(mesaLabel) ? `Mesa ${mesaLabel}` : mesaLabel };
    case 'takeaway':
      return { canal: 'takeaway', canalLabel: 'Takeaway' };
    case 'delivery':
      return { canal: 'delivery', canalLabel: 'Delivery' };
    case 'mostrador':
      return { canal: 'mostrador', canalLabel: 'Mostrador' };
    default:
      return { canal: 'otro', canalLabel: tipo ?? '—' };
  }
}

const DOW_ABBR = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Construye la serie de ventas: por hora (hoy) o por día (semana/mes), rellenando huecos. */
function construirSerie(
  modo: SerieModo,
  dias: number,
  rows: Array<{ bucket: string; total: string }>
): PuntoSerie[] {
  const totales = new Map(rows.map((r) => [r.bucket, Number(r.total)]));

  if (modo === 'hora') {
    const horaActual = Number(
      new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date())
    );
    const horasConVenta = [...totales.keys()].map(Number).filter((h) => (totales.get(String(h)) ?? 0) > 0);
    let desde = 12;
    let hasta = 23;
    if (horasConVenta.length > 0) {
      desde = Math.min(...horasConVenta);
      hasta = Math.min(23, Math.max(horaActual, ...horasConVenta));
    }
    const puntos: PuntoSerie[] = [];
    for (let h = desde; h <= hasta; h++) {
      puntos.push({ label: String(h), total: totales.get(String(h)) ?? 0 });
    }
    return puntos;
  }

  // modo === 'dia': N días terminando hoy (fecha en BA, aritmética de calendario en UTC al mediodía).
  const hoyBA = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
  const [Y, M, D] = hoyBA.split('-').map(Number);
  const puntos: PuntoSerie[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(Y, M - 1, D - i, 12));
    const key = dt.toISOString().slice(0, 10);
    const label = dias <= 7 ? DOW_ABBR[dt.getUTCDay()] : `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
    puntos.push({ label, total: totales.get(key) ?? 0 });
  }
  return puntos;
}

export async function getDashboardMetricsAction(
  tenantId: string,
  periodo: Periodo = 'hoy'
): Promise<DashboardMetrics> {
  // El tenant se toma de la sesión, nunca del parámetro del cliente.
  const session = await getCurrentSession();
  if (!session) return metricasVacias(periodo);
  tenantId = session.restauranteId;

  const { inicio, prevInicio, prevCorte, modo, dias } = ventanaPeriodo(periodo);

  const bucketExpr =
    modo === 'hora'
      ? sql`extract(hour from (${transaccionesPago.createdAt} AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int::text`
      : sql`to_char((${transaccionesPago.createdAt} AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD')`;

  try {
    const [
      totalMesasRow,
      ocupadasIdsRows,
      reservadasIdsRows,
      ventasRow,
      ventasPrevRow,
      pedidosRow,
      pedidosPrevRow,
      serieRows,
      pedidosRecientesRows,
    ] = await Promise.all([
      // Total de mesas reales (no sub-mesas, no eliminadas)
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(mesas)
        .where(
          and(eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt), isNull(mesas.parentMesaId))
        ),
      // Mesas físicas con sesión activa (ocupadas) — siempre en vivo
      db
        .selectDistinct({ mesaId: sesionesMesa.mesaId })
        .from(sesionesMesa)
        .where(
          and(
            eq(sesionesMesa.restauranteId, tenantId),
            eq(sesionesMesa.estado, 'Activa'),
            isNotNull(sesionesMesa.mesaId)
          )
        ),
      // Mesas con reserva para hoy (pendiente/confirmada) — siempre en vivo
      db
        .selectDistinct({ mesaId: reservas.mesaId })
        .from(reservas)
        .where(
          and(
            eq(reservas.restauranteId, tenantId),
            inArray(reservas.estado, ['Pendiente', 'Confirmada']),
            isNotNull(reservas.mesaId),
            sql`${reservas.inicio} >= ${INICIO_HOY}`,
            sql`${reservas.inicio} < ${FIN_HOY}`
          )
        ),
      // Ventas aprobadas del período
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
            sql`${transaccionesPago.createdAt} >= ${inicio}`
          )
        ),
      // Ventas aprobadas del período previo comparable
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
            sql`${transaccionesPago.createdAt} >= ${prevInicio}`,
            sql`${transaccionesPago.createdAt} < ${prevCorte}`
          )
        ),
      // Pedidos del período
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(pedidos)
        .where(and(eq(pedidos.restauranteId, tenantId), sql`${pedidos.createdAt} >= ${inicio}`)),
      // Pedidos del período previo comparable
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(pedidos)
        .where(
          and(
            eq(pedidos.restauranteId, tenantId),
            sql`${pedidos.createdAt} >= ${prevInicio}`,
            sql`${pedidos.createdAt} < ${prevCorte}`
          )
        ),
      // Serie de ventas (por hora u por día según el período)
      db
        .select({
          bucket: sql<string>`(${bucketExpr})`,
          total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
        })
        .from(transaccionesPago)
        .where(
          and(
            eq(transaccionesPago.restauranteId, tenantId),
            eq(transaccionesPago.estado, 'Aprobado'),
            sql`${transaccionesPago.createdAt} >= ${inicio}`
          )
        )
        .groupBy(sql`1`),
      // Últimos pedidos de todos los canales — siempre en vivo
      db
        .select({
          id: pedidos.id,
          estado: pedidos.estado,
          total: pedidos.total,
          createdAt: pedidos.createdAt,
          tipo: sesionesMesa.tipo,
          mesaLabel: mesas.identificador,
          items: sql<number>`coalesce(sum(${comandaItems.cantidad}), 0)::int`,
        })
        .from(pedidos)
        .innerJoin(sesionesMesa, eq(sesionesMesa.id, pedidos.sesionMesaId))
        .leftJoin(mesas, eq(mesas.id, sesionesMesa.mesaId))
        .leftJoin(comandaItems, eq(comandaItems.pedidoId, pedidos.id))
        .where(eq(pedidos.restauranteId, tenantId))
        .groupBy(pedidos.id, sesionesMesa.tipo, mesas.identificador)
        .orderBy(desc(pedidos.createdAt))
        .limit(6),
    ]);

    const totalMesas = totalMesasRow[0]?.c ?? 0;

    // Estado del salón: ocupadas tienen prioridad; las reservadas excluyen las ya ocupadas.
    const ocupadasSet = new Set(ocupadasIdsRows.map((r) => r.mesaId).filter(Boolean) as string[]);
    const reservadasSet = new Set(
      (reservadasIdsRows.map((r) => r.mesaId).filter(Boolean) as string[]).filter(
        (id) => !ocupadasSet.has(id)
      )
    );
    const ocupadas = ocupadasSet.size;
    const reservadas = reservadasSet.size;
    const libres = Math.max(0, totalMesas - ocupadas - reservadas);
    const porcentaje = totalMesas > 0 ? Math.round((ocupadas / totalMesas) * 100) : 0;

    const totalVentas = Number(ventasRow[0]?.total ?? 0);
    const cobros = ventasRow[0]?.cantidad ?? 0;
    const ticket = cobros > 0 ? totalVentas / cobros : 0;

    const totalPrev = Number(ventasPrevRow[0]?.total ?? 0);
    const cobrosPrev = ventasPrevRow[0]?.cantidad ?? 0;
    const ticketPrev = cobrosPrev > 0 ? totalPrev / cobrosPrev : 0;

    const totalPedidos = pedidosRow[0]?.c ?? 0;
    const totalPedidosPrev = pedidosPrevRow[0]?.c ?? 0;

    const puntos = construirSerie(modo, dias, serieRows);

    const pedidosRecientes: PedidoReciente[] = pedidosRecientesRows.map((r) => {
      const { canal, canalLabel } = canalDesdeTipo(r.tipo, r.mesaLabel);
      return {
        id: r.id,
        ref: `#${r.id.slice(0, 4).toUpperCase()}`,
        canal,
        canalLabel,
        items: r.items,
        total: Number(r.total),
        estado: r.estado,
        hora: r.createdAt.toISOString(),
      };
    });

    return {
      periodo,
      ocupacion: { mesasOcupadas: ocupadas, totalMesas, porcentaje },
      ventas: {
        total: totalVentas,
        cantidadCobros: cobros,
        ticketPromedio: ticket,
        deltaTotalPct: variacionPct(totalVentas, totalPrev),
        deltaTicketPct: variacionPct(ticket, ticketPrev),
      },
      pedidos: { total: totalPedidos, deltaPct: variacionPct(totalPedidos, totalPedidosPrev) },
      salon: { ocupadas, reservadas, libres, total: totalMesas },
      serie: { modo, puntos },
      pedidosRecientes,
    };
  } catch (error) {
    console.error('[getDashboardMetricsAction]', error);
    return metricasVacias(periodo);
  }
}
