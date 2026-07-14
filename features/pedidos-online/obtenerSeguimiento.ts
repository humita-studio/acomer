import { db } from '@/shared/db';
import { sesionesMesa, datosEntrega } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { obtenerTicketMesa, type TicketItem } from '@/features/pedidos/obtenerTicketMesa';
import { calcularCobroConPromos } from '@/features/promociones/cobroPromosActions';
import { canalDeTipoSesion } from '@/features/promociones/promociones';

export type SeguimientoPedido = {
  sesionMesaId: string;
  tipo: 'takeaway' | 'delivery';
  estadoEntrega: string;
  nombreContacto: string;
  telefono: string;
  direccion: string | null;
  referencia: string | null;
  costoEnvio: number;
  horaEstimada: string | null; // ISO
  items: TicketItem[];
  /** Total bruto de los ítems (sin descuento). */
  total: number;
  /** Descuento por promos (preview sin método elegido). */
  descuento: number;
  /** Total de los ítems ya con el descuento. */
  totalConDescuento: number;
  totalPagado: number;
  saldoPendiente: number;
  pagado: boolean;
};

/**
 * Datos para la pantalla pública de seguimiento de un pedido de retiro/envío
 * (estilo Rappi/PedidosYa): el estado de entrega, el detalle de lo pedido y si
 * ya está pagado. Es la fuente única de esa vista — la usan tanto el retorno de
 * pago como el link `/pedir?sesion=` una vez confirmado el pedido.
 */
export async function obtenerSeguimientoPedido(
  sesionMesaId: string,
): Promise<SeguimientoPedido | null> {
  const [fila] = await db
    .select({
      sesionMesaId: sesionesMesa.id,
      tipo: sesionesMesa.tipo,
      restauranteId: sesionesMesa.restauranteId,
      nombreContacto: datosEntrega.nombreContacto,
      telefono: datosEntrega.telefono,
      direccion: datosEntrega.direccion,
      referencia: datosEntrega.referencia,
      costoEnvio: datosEntrega.costoEnvio,
      estadoEntrega: datosEntrega.estadoEntrega,
      horaEstimada: datosEntrega.horaEstimada,
    })
    .from(datosEntrega)
    .innerJoin(sesionesMesa, eq(datosEntrega.sesionMesaId, sesionesMesa.id))
    .where(eq(sesionesMesa.id, sesionMesaId))
    .limit(1);

  if (!fila) return null;
  const tipo = fila.tipo;
  if (tipo !== 'takeaway' && tipo !== 'delivery') {
    return null;
  }

  // Ítems, descuento por promos y transacciones son lecturas independientes entre
  // sí: en paralelo en vez de en cadena (esta vista corre en el camino caliente
  // checkout → pago, donde cada round-trip de más se nota).
  const [ticket, promoSinMetodo, transacciones] = await Promise.all([
    obtenerTicketMesa(sesionMesaId),
    // Fallback para cuando el comensal todavía NO eligió cómo pagar: sin método,
    // el motor descarta las promos que dependen de él. Si falla, descuento = 0.
    calcularCobroConPromos(sesionMesaId, fila.restauranteId, {
      metodoPago: null,
      canal: canalDeTipoSesion(tipo),
    }).catch((error) => {
      console.warn('[obtenerSeguimiento] promos no calculadas:', error);
      return null;
    }),
    // Transacciones con método ya elegido (aprobada o pendiente). Cada una guarda
    // su monto NETO + el descuento que aplicó (snapshot del método elegido). Son la
    // fuente de verdad del descuento mostrado: el preview sin método borraría las
    // promos tipo "efectivo −10%" que el comensal ya eligió al pedir la cuenta.
    db.query.transaccionesPago.findMany({
      where: (t, { and, eq, inArray }) =>
        and(eq(t.sesionMesaId, sesionMesaId), inArray(t.estado, ['Aprobado', 'Pendiente'])),
    }),
  ]);

  const { items, total } = ticket;
  const pagosAprobados = transacciones.filter((t) => t.estado === 'Aprobado');
  const txPendiente = transacciones.find((t) => t.estado === 'Pendiente') ?? null;

  // Descuento mostrado: si ya hay pagos aprobados, la suma de sus descuentos
  // (consistente con el bruto cubierto); si está pendiente pero el comensal ya
  // eligió método, el de esa transacción; si no eligió nada, el preview sin método.
  const descuentoAprobado = pagosAprobados.reduce(
    (acc, tx) => acc + (Number(tx.descuento) || 0),
    0,
  );
  const descuento =
    pagosAprobados.length > 0
      ? descuentoAprobado
      : txPendiente
        ? Number(txPendiente.descuento) || 0
        : promoSinMetodo?.descuento ?? 0;

  const costoEnvio = Number(fila.costoEnvio ?? 0);
  const totalConDescuento = Math.max(0, total - descuento);
  // Pagado: cada transacción aprobada guarda su monto NETO + el descuento que
  // aplicó, así que el bruto cubierto = monto + descuento. Comparar contra
  // ítems + envío evita marcar pagado sin cubrir el delivery.
  const totalPagado = pagosAprobados.reduce((acc, tx) => acc + Number(tx.monto), 0);
  const brutoCubierto = pagosAprobados.reduce(
    (acc, tx) => acc + Number(tx.monto) + (Number(tx.descuento) || 0),
    0,
  );
  const totalBrutoConEnvio = total + costoEnvio;
  const aPagar = totalConDescuento + costoEnvio;
  const pagado = totalBrutoConEnvio > 0 && brutoCubierto + 1e-6 >= totalBrutoConEnvio;
  const saldoPendiente = pagado ? 0 : Math.max(0, aPagar - totalPagado);

  return {
    sesionMesaId: fila.sesionMesaId,
    tipo,
    estadoEntrega: fila.estadoEntrega,
    nombreContacto: fila.nombreContacto,
    telefono: fila.telefono,
    direccion: fila.direccion,
    referencia: fila.referencia,
    costoEnvio,
    horaEstimada: fila.horaEstimada ? new Date(fila.horaEstimada).toISOString() : null,
    items,
    total,
    descuento,
    totalConDescuento,
    totalPagado,
    saldoPendiente,
    pagado,
  };
}
