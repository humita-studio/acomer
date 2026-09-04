import { describe, expect, it } from 'vitest';
import {
  formatMoneyFromValue,
  formatMoneyTyping,
  parseMontoInput,
} from './format';

describe('formatMoneyTyping', () => {
  it('formatea miles mientras se escribe', () => {
    expect(formatMoneyTyping('1')).toEqual({ display: '1', value: '1' });
    expect(formatMoneyTyping('15')).toEqual({ display: '15', value: '15' });
    expect(formatMoneyTyping('1500')).toEqual({ display: '1.500', value: '1500' });
    expect(formatMoneyTyping('1500000')).toEqual({ display: '1.500.000', value: '1500000' });
  });

  it('acepta decimales con coma o punto', () => {
    expect(formatMoneyTyping('1500,5')).toEqual({ display: '1.500,5', value: '1500.5' });
    expect(formatMoneyTyping('1500.50')).toEqual({ display: '1.500,50', value: '1500.50' });
    expect(formatMoneyTyping('0,99')).toEqual({ display: '0,99', value: '0.99' });
  });

  it('limita a 2 decimales', () => {
    expect(formatMoneyTyping('10,999')).toEqual({ display: '10,99', value: '10.99' });
  });

  it('mantiene coma pendiente al tipear', () => {
    expect(formatMoneyTyping('1500,')).toEqual({ display: '1.500,', value: '1500' });
  });

  it('parsea pegado con formato es-AR', () => {
    expect(formatMoneyTyping('1.500,50')).toEqual({ display: '1.500,50', value: '1500.50' });
    expect(formatMoneyTyping('$ 1.500')).toEqual({ display: '1.500', value: '1500' });
  });

  it('puede desactivar decimales', () => {
    expect(formatMoneyTyping('1500,50', { allowDecimals: false })).toEqual({
      display: '150.050',
      value: '150050',
    });
  });

  it('soporta tipeo secuencial con puntos de miles ya formateados', () => {
    // Cuando el usuario sigue escribiendo sobre un valor ya formateado como "1.000"
    expect(formatMoneyTyping('1.0000')).toEqual({ display: '10.000', value: '10000' });
    expect(formatMoneyTyping('10.0000')).toEqual({ display: '100.000', value: '100000' });
    expect(formatMoneyTyping('100.0000')).toEqual({ display: '1.000.000', value: '1000000' });
    expect(formatMoneyTyping('5.0000')).toEqual({ display: '50.000', value: '50000' });
  });

  it('soporta borrar dígitos (backspace) sobre valores con puntos de miles', () => {
    // Al borrar el último dígito de "1.000" queda "1.00"
    expect(formatMoneyTyping('1.00')).toEqual({ display: '100', value: '100' });
    expect(formatMoneyTyping('10.00')).toEqual({ display: '1.000', value: '1000' });
    expect(formatMoneyTyping('50.00')).toEqual({ display: '5.000', value: '5000' });
  });

  it('vacío devuelve vacío', () => {
    expect(formatMoneyTyping('')).toEqual({ display: '', value: '' });
    expect(formatMoneyTyping('abc')).toEqual({ display: '', value: '' });
  });
});

describe('formatMoneyFromValue', () => {
  it('formatea valores canónicos', () => {
    expect(formatMoneyFromValue(1500)).toBe('1.500');
    expect(formatMoneyFromValue('1500.5')).toBe('1.500,5');
    expect(formatMoneyFromValue('')).toBe('');
    expect(formatMoneyFromValue(null)).toBe('');
  });
});

describe('parseMontoInput', () => {
  it('parsea strings formateados', () => {
    expect(parseMontoInput('1.500,50')).toBe(1500.5);
    expect(parseMontoInput('1500')).toBe(1500);
    expect(parseMontoInput('')).toBeNull();
    expect(parseMontoInput(42)).toBe(42);
  });
});
