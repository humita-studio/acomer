/**
 * Lógica pura de liquidación post-pago (sin DB ni side-effects).
 * Usada por el webhook de MP y por tests unitarios.
 */

export type PedidoLite = {
  id: string;
  estado: string;
  total: number | string;
};

export type TransaccionLite = {
  id: string;
  estado: string;
  monto: number | string;
};

export type TipoSesion = 'salon' | 'takeaway' | 'delivery' | string | null | undefined;

export type SettlementDecision =
  | { kind: 'noop' }
  /** Pago no aprobado: solo se actualiza la tx, sin tocar pedidos/sesión. */
  | { kind: 'status_only'; }
  | {
      kind: 'partial';
      totalPedidos: number;
      totalPagado: number;
    }
  | {
      kind: 'full';
      totalPedidos: number;
      totalPagado: number;
      pedidoIdsAMarcarPagado: string[];
      /** Cerrar sesión solo en salón (no takeaway/delivery). */
      cerrarSesion: boolean;
    };

function num(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

/**
 * Decide qué hacer cuando una transacción pasa a un nuevo estado.
 *
 * @param currentTxId id de la tx que acaba de verificarse
 * @param newStatus estado verificado en el proveedor
 * @param pedidos pedidos de la sesión
 * @param transacciones todas las txs de la sesión (incluye la actual con estado viejo)
 * @param tipoSesion tipo de sesión de mesa
 * @param alreadyFinal si la tx ya estaba en el mismo estado final (idempotencia)
 */
export function decideSettlement(opts: {
  currentTxId: string;
  newStatus: string;
  pedidos: PedidoLite[];
  transacciones: TransaccionLite[];
  tipoSesion?: TipoSesion;
  alreadyFinal?: boolean;
}): SettlementDecision {
  if (opts.alreadyFinal) {
    return { kind: 'noop' };
  }

  if (opts.newStatus !== 'Aprobado') {
    return { kind: 'status_only' };
  }

  const pedidosActivos = opts.pedidos.filter((p) => p.estado !== 'Cancelado');
  const totalPedidos = pedidosActivos.reduce((acc, p) => acc + num(p.total), 0);

  // Total pagado: txs ya Aprobadas + la actual si no estaba Aprobada.
  const totalPagado = opts.transacciones.reduce((acc, t) => {
    if (t.id === opts.currentTxId) {
      return acc + (opts.newStatus === 'Aprobado' ? num(t.monto) : 0);
    }
    return acc + (t.estado === 'Aprobado' ? num(t.monto) : 0);
  }, 0);

  if (totalPagado + 1e-9 < totalPedidos) {
    return {
      kind: 'partial',
      totalPedidos,
      totalPagado,
    };
  }

  const esExterno = opts.tipoSesion === 'takeaway' || opts.tipoSesion === 'delivery';

  return {
    kind: 'full',
    totalPedidos,
    totalPagado,
    pedidoIdsAMarcarPagado: pedidosActivos.map((p) => p.id),
    cerrarSesion: !esExterno,
  };
}

/**
 * Metadatos de la transacción: guardamos el payment id del proveedor para
 * idempotencia ante reintentos del webhook.
 */
export type TxMetadata = {
  providerPaymentId?: string;
  [key: string]: unknown;
};

export function mergePaymentMetadata(
  existing: unknown,
  providerPaymentId: string,
  verificationMetadata: unknown,
): TxMetadata {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? ({ ...(existing as Record<string, unknown>) } as TxMetadata)
      : ({} as TxMetadata);

  return {
    ...base,
    providerPaymentId,
    providerPayload: verificationMetadata ?? null,
  };
}

export function isAlreadyProcessed(
  estado: string,
  metadata: unknown,
  providerPaymentId: string,
  newStatus: string,
): boolean {
  if (estado !== newStatus) return false;
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as TxMetadata;
  return m.providerPaymentId === providerPaymentId;
}
