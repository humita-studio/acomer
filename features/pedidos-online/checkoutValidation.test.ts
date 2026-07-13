import { describe, expect, it } from 'vitest';
import { telefonoValido, validarCheckoutCliente } from './checkoutValidation';
import {
  cumplePedidoMinimo,
  costoEnvioEfectivo,
  DELIVERY_CONFIG_DEFAULT,
} from './deliveryConfig';

describe('telefonoValido', () => {
  it('acepta números AR comunes', () => {
    expect(telefonoValido('11 2345 6789')).toBe(true);
    expect(telefonoValido('+54 9 11 2345-6789')).toBe(true);
  });

  it('rechaza cortos o vacíos', () => {
    expect(telefonoValido('123')).toBe(false);
    expect(telefonoValido('')).toBe(false);
  });
});

describe('validarCheckoutCliente', () => {
  it('ok takeaway completo', () => {
    expect(
      validarCheckoutCliente({
        nombre: 'Ana',
        telefono: '1123456789',
        tipo: 'takeaway',
        itemsCount: 1,
      }),
    ).toBeNull();
  });

  it('exige dirección en delivery', () => {
    const err = validarCheckoutCliente({
      nombre: 'Ana',
      telefono: '1123456789',
      tipo: 'delivery',
      direccion: 'x',
      itemsCount: 1,
    });
    expect(err).toMatch(/dirección/i);
  });

  it('carrito vacío', () => {
    expect(
      validarCheckoutCliente({
        nombre: 'Ana',
        telefono: '1123456789',
        tipo: 'takeaway',
        itemsCount: 0,
      }),
    ).toMatch(/vacío/i);
  });

  it('exige pedido mínimo en delivery', () => {
    const err = validarCheckoutCliente({
      nombre: 'Ana',
      telefono: '1123456789',
      tipo: 'delivery',
      direccion: 'Calle Falsa 123',
      itemsCount: 1,
      subtotalCarrito: 500,
      deliveryConfig: { pedidoMinimo: 2000, zonaPoligono: null },
    });
    expect(err).toMatch(/mínimo/i);
  });

  it('pasa si llega al mínimo', () => {
    expect(
      validarCheckoutCliente({
        nombre: 'Ana',
        telefono: '1123456789',
        tipo: 'delivery',
        direccion: 'Calle Falsa 123',
        itemsCount: 1,
        subtotalCarrito: 2500,
        deliveryConfig: { pedidoMinimo: 2000, zonaPoligono: null },
      }),
    ).toBeNull();
  });

  it('exige pin si hay zona dibujada', () => {
    const poly = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-58.435, -34.575],
          [-58.405, -34.575],
          [-58.405, -34.595],
          [-58.435, -34.595],
          [-58.435, -34.575],
        ],
      ],
    };
    const err = validarCheckoutCliente({
      nombre: 'Ana',
      telefono: '1123456789',
      tipo: 'delivery',
      direccion: 'Calle Falsa 123',
      itemsCount: 1,
      subtotalCarrito: 3000,
      deliveryConfig: { pedidoMinimo: 0, zonaPoligono: poly },
    });
    expect(err).toMatch(/mapa/i);

    expect(
      validarCheckoutCliente({
        nombre: 'Ana',
        telefono: '1123456789',
        tipo: 'delivery',
        direccion: 'Calle Falsa 123',
        itemsCount: 1,
        subtotalCarrito: 3000,
        deliveryConfig: { pedidoMinimo: 0, zonaPoligono: poly },
        pin: { lat: -34.585, lng: -58.42 },
      }),
    ).toBeNull();
  });
});

describe('cumplePedidoMinimo / costoEnvioEfectivo', () => {
  it('takeaway ignora mínimo y envío', () => {
    expect(cumplePedidoMinimo({ pedidoMinimo: 5000 }, 'takeaway', 100)).toBe(true);
    expect(costoEnvioEfectivo({ costoEnvio: 800 }, 'takeaway')).toBe(0);
  });

  it('delivery aplica envío y mínimo', () => {
    expect(cumplePedidoMinimo({ pedidoMinimo: 1000 }, 'delivery', 999)).toBe(false);
    expect(cumplePedidoMinimo({ pedidoMinimo: 1000 }, 'delivery', 1000)).toBe(true);
    expect(costoEnvioEfectivo({ costoEnvio: 800 }, 'delivery')).toBe(800);
    expect(costoEnvioEfectivo(DELIVERY_CONFIG_DEFAULT, 'delivery')).toBe(0);
  });
});
