import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/shared/db/client', () => ({
  getConnectionString: vi.fn(() => 'postgres://fake:fake@localhost:5432/acomer_test'),
  createClient: vi.fn(() => ({})),
  db: {},
}));

vi.mock('@/shared/db/secure-wrapper', () => ({
  withTenant: vi.fn(async (_claims, callback) => {
    const fakeDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(async (txCb: any) => txCb({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue([]),
      })),
    };
    return callback(fakeDb);
  }),
}));

import { createCopilotTools } from './copilotTools';
import type { AuthSession } from '@/features/auth/session';

describe('createCopilotTools Suite', () => {
  const fakeSession: AuthSession = {
    user: { id: 'usr-123', email: 'owner@acomer.com' } as any,
    perfilId: 'prf-123',
    restauranteId: 'rest-123',
    nombreRestaurante: 'Bodegón de Pepe',
    slugRestaurante: 'bodegon-de-pepe',
    role: 'owner',
  };

  it('instancia las 15 herramientas operativas completas', () => {
    const tools = createCopilotTools(fakeSession);

    expect(tools.consultarMetricasDelDia).toBeDefined();
    expect(tools.consultarEstadoSalon).toBeDefined();
    expect(tools.consultarEstadoCocina).toBeDefined();
    expect(tools.consultarPedidosDelivery).toBeDefined();
    expect(tools.consultarReservas).toBeDefined();
    expect(tools.consultarResenasClientes).toBeDefined();
    expect(tools.consultarDesgloseMetodosPago).toBeDefined();
    expect(tools.consultarEstadoCaja).toBeDefined();
    expect(tools.consultarPlatosMasVendidos).toBeDefined();
    expect(tools.buscarPlatosEnCarta).toBeDefined();
    expect(tools.pausarOActivarPlato).toBeDefined();
    expect(tools.actualizarPrecioPlato).toBeDefined();
    expect(tools.ajustarPreciosMasivo).toBeDefined();
    expect(tools.consultarPromocionesActivas).toBeDefined();
    expect(tools.consultarEquipoStaff).toBeDefined();
  });

  it('todas las tools poseen descripciones claras para Gemini', () => {
    const tools = createCopilotTools(fakeSession);

    for (const [name, toolInstance] of Object.entries(tools)) {
      expect(toolInstance.description, `La herramienta ${name} debe tener descripción`).toBeTruthy();
      expect(toolInstance.description!.length).toBeGreaterThan(15);
    }
  });

  it('bloquea la modificación de precios si el rol no tiene permisos', async () => {
    const mozoSession: AuthSession = {
      ...fakeSession,
      role: 'mozo',
    };
    const tools = createCopilotTools(mozoSession);

    const resIndividual = await (tools.actualizarPrecioPlato as any).execute({
      nombrePlato: 'Milanesa',
      nuevoPrecio: 5000,
    });
    expect(resIndividual.exito).toBe(false);
    expect(resIndividual.mensaje).toContain('permisos');

    const resMasivo = await (tools.ajustarPreciosMasivo as any).execute({
      porcentaje: 10,
    });
    expect(resMasivo.exito).toBe(false);
    expect(resMasivo.mensaje).toContain('permisos');
  });
});