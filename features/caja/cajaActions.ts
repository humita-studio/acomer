'use server';

import { db } from '@/shared/db';
import { sesionesCaja, movimientosCaja, transaccionesPago } from '@/shared/db/schema';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import type { TipoMovimiento, CajaActual, CajaCerrada, DetalleCierre } from './types';

// El `db` de cada acción es el handle transaccional de withTenant (RLS activo).
// `calcularTotales` sigue usando el db de módulo, escopado por el tenantId de la
// sesión que se le pasa.

type Totales = {
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasMercadoPago: number;
  ingresos: number;
  egresos: number;
  retiros: number;
  esperadoEnCaja: number;
};

type Resultado = { success: boolean; message: string };

/**
 * Calcula los totales en vivo de una sesión de caja: ventas cobradas por método
 * dentro de la ventana de la caja (por tiempo) y movimientos manuales.
 * El efectivo esperado = inicial + ventas en efectivo + ingresos − egresos − retiros.
 */
async function calcularTotales(
  tenantId: string,
  sesionCajaId: string,
  abiertaAt: Date,
  montoInicial: number,
  cerradaAt?: Date | null
): Promise<Totales> {
  const [ventasRows, movRows] = await Promise.all([
    db
      .select({
        proveedor: transaccionesPago.proveedor,
        total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
      })
      .from(transaccionesPago)
      .where(
        and(
          eq(transaccionesPago.restauranteId, tenantId),
          eq(transaccionesPago.estado, 'Aprobado'),
          gte(transaccionesPago.createdAt, abiertaAt),
          // Si la caja ya cerró, acotamos las ventas a la ventana del turno.
          cerradaAt ? lte(transaccionesPago.createdAt, cerradaAt) : undefined
        )
      )
      .groupBy(transaccionesPago.proveedor),
    db
      .select({
        tipo: movimientosCaja.tipo,
        total: sql<string>`coalesce(sum(${movimientosCaja.monto}), 0)`,
      })
      .from(movimientosCaja)
      .where(eq(movimientosCaja.sesionCajaId, sesionCajaId))
      .groupBy(movimientosCaja.tipo),
  ]);

  const ventas = new Map(ventasRows.map((r) => [r.proveedor, Number(r.total)]));
  const movs = new Map(movRows.map((r) => [r.tipo, Number(r.total)]));

  const ventasEfectivo = ventas.get('efectivo') ?? 0;
  const ventasTarjeta = ventas.get('tarjeta_fisica') ?? 0;
  const ventasMercadoPago = (ventas.get('mercado_pago') ?? 0) + (ventas.get('mock') ?? 0);
  const ingresos = movs.get('ingreso') ?? 0;
  const egresos = movs.get('egreso') ?? 0;
  const retiros = movs.get('retiro') ?? 0;

  return {
    ventasEfectivo,
    ventasTarjeta,
    ventasMercadoPago,
    ingresos,
    egresos,
    retiros,
    esperadoEnCaja: montoInicial + ventasEfectivo + ingresos - egresos - retiros,
  };
}

/** Sesión de caja abierta del restaurante (o null), con totales y movimientos. */
export async function getCajaActualAction(): Promise<CajaActual | null> {
  try {
    const session = await getCurrentSession();
    if (!session || !canAccessSection(session.role, 'cashier')) return null;
    const rid = session.restauranteId;

    const sesion = await withTenant(claimsFromSession(session), (db) =>
      db.query.sesionesCaja.findFirst({
        where: and(eq(sesionesCaja.restauranteId, rid), eq(sesionesCaja.estado, 'Abierta')),
        orderBy: [desc(sesionesCaja.abiertaAt)],
        with: {
          movimientos: { orderBy: [desc(movimientosCaja.createdAt)] },
        },
      })
    );

    if (!sesion) return null;

    const montoInicial = Number(sesion.montoInicial);
    const totales = await calcularTotales(rid, sesion.id, sesion.abiertaAt, montoInicial);

    return {
      id: sesion.id,
      montoInicial,
      abiertaAt: sesion.abiertaAt,
      abiertaPor: sesion.abiertaPor,
      ...totales,
      movimientos: sesion.movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo as TipoMovimiento,
        monto: Number(m.monto),
        concepto: m.concepto,
        createdAt: m.createdAt,
      })),
    };
  } catch (error) {
    console.error('[getCajaActualAction]', error);
    return null;
  }
}

/** Abre una caja con un monto inicial. Falla si ya hay una caja abierta. */
export async function abrirCajaAction(montoInicial: number): Promise<Resultado> {
  try {
    const session = await getCurrentSession();
    if (!session || !canAccessSection(session.role, 'cashier')) {
      return { success: false, message: 'No autorizado.' };
    }

    const monto = Number(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) {
      return { success: false, message: 'El monto inicial no es válido.' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const yaAbierta = await db.query.sesionesCaja.findFirst({
        where: and(
          eq(sesionesCaja.restauranteId, session.restauranteId),
          eq(sesionesCaja.estado, 'Abierta')
        ),
      });
      if (yaAbierta) {
        return { success: false, message: 'Ya hay una caja abierta. Cerrala antes de abrir otra.' };
      }

      await db.insert(sesionesCaja).values({
        restauranteId: session.restauranteId,
        abiertaPor: session.user.id,
        montoInicial: monto.toFixed(2),
        estado: 'Abierta',
      });

      return { success: true, message: 'Caja abierta.' };
    });

    return res;
  } catch (error) {
    console.error('[abrirCajaAction]', error);
    return { success: false, message: 'No se pudo abrir la caja.' };
  }
}

/** Registra un movimiento manual (ingreso/egreso/retiro) en la caja abierta. */
export async function registrarMovimientoAction(
  sesionCajaId: string,
  tipo: TipoMovimiento,
  monto: number,
  concepto: string
): Promise<Resultado> {
  try {
    const session = await getCurrentSession();
    if (!session || !canAccessSection(session.role, 'cashier')) {
      return { success: false, message: 'No autorizado.' };
    }

    if (!['ingreso', 'egreso', 'retiro'].includes(tipo)) {
      return { success: false, message: 'Tipo de movimiento inválido.' };
    }
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      return { success: false, message: 'El monto debe ser mayor a cero.' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const sesion = await db.query.sesionesCaja.findFirst({
        where: and(
          eq(sesionesCaja.id, sesionCajaId),
          eq(sesionesCaja.restauranteId, session.restauranteId)
        ),
      });
      if (!sesion || sesion.estado !== 'Abierta') {
        return { success: false, message: 'La caja no está abierta.' };
      }

      await db.insert(movimientosCaja).values({
        restauranteId: session.restauranteId,
        sesionCajaId,
        tipo,
        monto: m.toFixed(2),
        concepto: concepto.trim() || null,
        registradoPor: session.user.id,
      });

      return { success: true, message: 'Movimiento registrado.' };
    });

    return res;
  } catch (error) {
    console.error('[registrarMovimientoAction]', error);
    return { success: false, message: 'No se pudo registrar el movimiento.' };
  }
}

/** Cierra la caja: calcula esperado vs contado y guarda la diferencia. */
export async function cerrarCajaAction(
  sesionCajaId: string,
  montoContado: number,
  notas: string
): Promise<Resultado & { diferencia?: number }> {
  try {
    const session = await getCurrentSession();
    if (!session || !canAccessSection(session.role, 'cashier')) {
      return { success: false, message: 'No autorizado.' };
    }

    const contado = Number(montoContado);
    if (!Number.isFinite(contado) || contado < 0) {
      return { success: false, message: 'El monto contado no es válido.' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const sesion = await db.query.sesionesCaja.findFirst({
        where: and(
          eq(sesionesCaja.id, sesionCajaId),
          eq(sesionesCaja.restauranteId, session.restauranteId)
        ),
      });
      if (!sesion || sesion.estado !== 'Abierta') {
        return { success: false, message: 'La caja no está abierta.' };
      }

      const montoInicial = Number(sesion.montoInicial);
      const { esperadoEnCaja } = await calcularTotales(
        session.restauranteId,
        sesion.id,
        sesion.abiertaAt,
        montoInicial
      );
      const diferencia = contado - esperadoEnCaja;

      await db
        .update(sesionesCaja)
        .set({
          estado: 'Cerrada',
          cerradaPor: session.user.id,
          cerradaAt: new Date(),
          montoFinalContado: contado.toFixed(2),
          montoEsperado: esperadoEnCaja.toFixed(2),
          diferencia: diferencia.toFixed(2),
          notasCierre: notas.trim() || null,
        })
        .where(eq(sesionesCaja.id, sesion.id));

      return { success: true, message: 'Caja cerrada.', diferencia };
    });

    return res;
  } catch (error) {
    console.error('[cerrarCajaAction]', error);
    return { success: false, message: 'No se pudo cerrar la caja.' };
  }
}

/** Historial de cajas cerradas (más recientes primero). */
export async function getHistorialCajasAction(limit = 10): Promise<CajaCerrada[]> {
  try {
    const session = await getCurrentSession();
    if (!session || !canAccessSection(session.role, 'cashier')) return [];
    const rid = session.restauranteId;

    const cajas = await withTenant(claimsFromSession(session), (db) =>
      db.query.sesionesCaja.findMany({
        where: and(eq(sesionesCaja.restauranteId, rid), eq(sesionesCaja.estado, 'Cerrada')),
        orderBy: [desc(sesionesCaja.cerradaAt)],
        limit,
      })
    );

    return cajas.map((c) => ({
      id: c.id,
      abiertaAt: c.abiertaAt,
      cerradaAt: c.cerradaAt,
      montoInicial: Number(c.montoInicial),
      montoEsperado: Number(c.montoEsperado ?? 0),
      montoFinalContado: Number(c.montoFinalContado ?? 0),
      diferencia: Number(c.diferencia ?? 0),
    }));
  } catch (error) {
    console.error('[getHistorialCajasAction]', error);
    return [];
  }
}

/**
 * Desglose de un cierre para el modal de detalle: recomputa ventas y
 * movimientos de la ventana del turno y devuelve esperado/contado/diferencia.
 */
export async function getDetalleCierreAction(
  sesionCajaId: string
): Promise<DetalleCierre | null> {
  try {
    const session = await getCurrentSession();
    if (!session || !canAccessSection(session.role, 'cashier')) return null;

    const sesion = await withTenant(claimsFromSession(session), (db) =>
      db.query.sesionesCaja.findFirst({
        where: and(
          eq(sesionesCaja.id, sesionCajaId),
          eq(sesionesCaja.restauranteId, session.restauranteId)
        ),
      })
    );
    if (!sesion) return null;

    const montoInicial = Number(sesion.montoInicial);
    const totales = await calcularTotales(
      session.restauranteId,
      sesion.id,
      sesion.abiertaAt,
      montoInicial,
      sesion.cerradaAt
    );

    const contado = Number(sesion.montoFinalContado ?? 0);
    const esperado = Number(sesion.montoEsperado ?? totales.esperadoEnCaja);

    return {
      id: sesion.id,
      abiertaAt: sesion.abiertaAt,
      cerradaAt: sesion.cerradaAt,
      montoInicial,
      ventasEfectivo: totales.ventasEfectivo,
      ingresos: totales.ingresos,
      egresos: totales.egresos,
      retiros: totales.retiros,
      esperado,
      contado,
      diferencia: Number(sesion.diferencia ?? contado - esperado),
    };
  } catch (error) {
    console.error('[getDetalleCierreAction]', error);
    return null;
  }
}
