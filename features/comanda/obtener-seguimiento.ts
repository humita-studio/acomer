import { db } from '@/shared/db';
import { sesionesMesa, datosEntrega } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { obtenerTicketMesa, type TicketItem } from './obtener-ticket-mesa';

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
  total: number;
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

  const { items, total } = await obtenerTicketMesa(sesionMesaId);

  // Pagado: la suma de pagos aprobados cubre el total (> 0).
  const pagosAprobados = await db.query.transaccionesPago.findMany({
    where: (t, { and, eq }) =>
      and(eq(t.sesionMesaId, sesionMesaId), eq(t.estado, 'Aprobado')),
  });
  const totalPagado = pagosAprobados.reduce((acc, tx) => acc + Number(tx.monto), 0);
  const saldoPendiente = Math.max(0, total - totalPagado);

  return {
    sesionMesaId: fila.sesionMesaId,
    tipo,
    estadoEntrega: fila.estadoEntrega,
    nombreContacto: fila.nombreContacto,
    telefono: fila.telefono,
    direccion: fila.direccion,
    referencia: fila.referencia,
    costoEnvio: Number(fila.costoEnvio ?? 0),
    horaEstimada: fila.horaEstimada ? new Date(fila.horaEstimada).toISOString() : null,
    items,
    total,
    totalPagado,
    saldoPendiente,
    pagado: total > 0 && totalPagado >= total,
  };
}
