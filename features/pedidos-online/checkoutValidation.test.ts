import { describe, expect, it } from 'vitest';
import { telefonoValido, validarCheckoutCliente } from './checkoutValidation';

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
});
