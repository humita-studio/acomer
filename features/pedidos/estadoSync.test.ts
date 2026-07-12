import { describe, expect, it } from 'vitest';
import { cocinaAEntrega, entregaACocina } from './estadoSync';

describe('estadoSync cocina ↔ entrega', () => {
  it('mapea cocina → entrega (flujo prep)', () => {
    expect(cocinaAEntrega('Pendiente')).toBe('Recibido');
    expect(cocinaAEntrega('En Preparación')).toBe('EnPreparacion');
    expect(cocinaAEntrega('Listo')).toBe('Listo');
    expect(cocinaAEntrega('Entregado')).toBe('Entregado');
    expect(cocinaAEntrega('Cancelado')).toBe('Cancelado');
  });

  it('mapea entrega → cocina (EnCamino sale del KDS)', () => {
    expect(entregaACocina('Recibido')).toBe('Pendiente');
    expect(entregaACocina('EnPreparacion')).toBe('En Preparación');
    expect(entregaACocina('Listo')).toBe('Listo');
    expect(entregaACocina('EnCamino')).toBe('Entregado');
    expect(entregaACocina('Entregado')).toBe('Entregado');
    expect(entregaACocina('Cancelado')).toBe('Cancelado');
  });

  it('ida y vuelta en estados de prep es estable', () => {
    const ida = cocinaAEntrega('En Preparación');
    expect(ida).toBe('EnPreparacion');
    expect(entregaACocina(ida!)).toBe('En Preparación');

    const idaListo = cocinaAEntrega('Listo');
    expect(entregaACocina(idaListo!)).toBe('Listo');
  });
});
