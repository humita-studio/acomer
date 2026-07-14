import { describe, expect, it } from 'vitest';
import {
  decideSettlement,
  isAlreadyProcessed,
  mergePaymentMetadata,
} from './settlement-core';

describe('decideSettlement', () => {
  const pedidos = [
    { id: 'p1', estado: 'Pendiente', total: 1000 },
    { id: 'p2', estado: 'Listo', total: 500 },
    { id: 'p3', estado: 'Cancelado', total: 200 },
  ];

  it('no-op si alreadyFinal', () => {
    const d = decideSettlement({
      currentTxId: 'tx1',
      newStatus: 'Aprobado',
      pedidos,
      transacciones: [{ id: 'tx1', estado: 'Aprobado', monto: 1500 }],
      alreadyFinal: true,
    });
    expect(d.kind).toBe('noop');
  });

  it('status_only si no está Aprobado', () => {
    const d = decideSettlement({
      currentTxId: 'tx1',
      newStatus: 'Pendiente',
      pedidos,
      transacciones: [{ id: 'tx1', estado: 'Pendiente', monto: 1500 }],
    });
    expect(d.kind).toBe('status_only');
  });

  it('partial si el pago no cubre el total', () => {
    const d = decideSettlement({
      currentTxId: 'tx1',
      newStatus: 'Aprobado',
      pedidos,
      transacciones: [{ id: 'tx1', estado: 'Pendiente', monto: 500 }],
      tipoSesion: 'salon',
    });
    expect(d.kind).toBe('partial');
    if (d.kind === 'partial') {
      expect(d.totalPedidos).toBe(1500);
      expect(d.totalPagado).toBe(500);
    }
  });

  it('full en salón cierra sesión y marca pedidos', () => {
    const d = decideSettlement({
      currentTxId: 'tx1',
      newStatus: 'Aprobado',
      pedidos,
      transacciones: [
        { id: 'tx0', estado: 'Aprobado', monto: 500 },
        { id: 'tx1', estado: 'Pendiente', monto: 1000 },
      ],
      tipoSesion: 'salon',
    });
    expect(d.kind).toBe('full');
    if (d.kind === 'full') {
      expect(d.cerrarSesion).toBe(true);
      expect(d.pedidoIdsAMarcarPagado).toEqual(['p1', 'p2']);
      expect(d.totalPagado).toBe(1500);
    }
  });

  it('full en takeaway NO cierra sesión y deja el pedido en cocina', () => {
    const d = decideSettlement({
      currentTxId: 'tx1',
      newStatus: 'Aprobado',
      pedidos: [{ id: 'p1', estado: 'Pendiente', total: 100 }],
      transacciones: [{ id: 'tx1', estado: 'Pendiente', monto: 100 }],
      tipoSesion: 'takeaway',
    });
    expect(d.kind).toBe('full');
    if (d.kind === 'full') {
      expect(d.cerrarSesion).toBe(false);
      expect(d.pedidoIdsAMarcarPagado).toEqual([]);
    }
  });

  it('full en mostrador: cobrado (cierra sesión) pero sigue en cocina', () => {
    const d = decideSettlement({
      currentTxId: 'tx1',
      newStatus: 'Aprobado',
      pedidos: [{ id: 'p1', estado: 'Pendiente', total: 500 }],
      transacciones: [{ id: 'tx1', estado: 'Pendiente', monto: 500 }],
      tipoSesion: 'mostrador',
    });
    expect(d.kind).toBe('full');
    if (d.kind === 'full') {
      expect(d.cerrarSesion).toBe(true);
      // No marcar Pagado: cocina necesita ver qué preparar.
      expect(d.pedidoIdsAMarcarPagado).toEqual([]);
    }
  });
});

describe('isAlreadyProcessed / mergePaymentMetadata', () => {
  it('detecta reintento del mismo payment id', () => {
    const meta = mergePaymentMetadata({}, 'pay_1', { foo: 1 });
    expect(meta.providerPaymentId).toBe('pay_1');
    expect(isAlreadyProcessed('Aprobado', meta, 'pay_1', 'Aprobado')).toBe(true);
    expect(isAlreadyProcessed('Aprobado', meta, 'pay_2', 'Aprobado')).toBe(false);
    expect(isAlreadyProcessed('Pendiente', meta, 'pay_1', 'Aprobado')).toBe(false);
  });
});
