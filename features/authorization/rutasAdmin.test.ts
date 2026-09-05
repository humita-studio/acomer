import { describe, expect, it } from 'vitest';
import {
  canAccessSection,
  rutaInicialAdmin,
  seccionDeRutaAdmin,
  type RoleType,
} from './roles';

describe('seccionDeRutaAdmin', () => {
  it('mapea rutas y subrutas del panel a su sección', () => {
    expect(seccionDeRutaAdmin('/admin/menu')).toBe('menu');
    expect(seccionDeRutaAdmin('/admin/menu/')).toBe('menu');
    expect(seccionDeRutaAdmin('/admin/promociones')).toBe('menu');
    expect(seccionDeRutaAdmin('/admin/staff')).toBe('staff');
    expect(seccionDeRutaAdmin('/admin/mesas/abc')).toBe('tables');
    expect(seccionDeRutaAdmin('/admin/billing')).toBe('settings');
    expect(seccionDeRutaAdmin('/admin/configuracion')).toBe('settings');
    expect(seccionDeRutaAdmin('/admin/pedidos-online')).toBe('delivery');
  });

  it('no confunde prefijos parciales ni rutas sin mapear', () => {
    expect(seccionDeRutaAdmin('/admin')).toBeNull();
    expect(seccionDeRutaAdmin('/admin/menudo')).toBeNull();
    expect(seccionDeRutaAdmin('/admin/cajas')).toBeNull();
  });
});

describe('acceso por rol a las rutas del panel', () => {
  const rutas = [
    '/admin/menu', '/admin/promociones', '/admin/staff', '/admin/mesas', '/admin/reportes',
    '/admin/resenas', '/admin/cocina', '/admin/caja', '/admin/cobros', '/admin/configuracion',
    '/admin/billing', '/admin/reservas', '/admin/pedidos-online',
  ];
  const permitidas = (role: RoleType) =>
    rutas.filter((r) => canAccessSection(role, seccionDeRutaAdmin(r)!));

  it('dueño y admin entran a todo', () => {
    expect(permitidas('owner')).toEqual(rutas);
    expect(permitidas('admin')).toEqual(rutas);
  });

  it('cocina solo ve el tablero', () => {
    expect(permitidas('cocina')).toEqual(['/admin/cocina']);
  });

  it('cajero: mesas, caja y cobros', () => {
    expect(permitidas('cajero')).toEqual(['/admin/mesas', '/admin/caja', '/admin/cobros']);
  });

  it('mozo: operación de salón sin caja ni configuración', () => {
    expect(permitidas('mozo')).toEqual([
      '/admin/mesas', '/admin/cocina', '/admin/cobros', '/admin/reservas', '/admin/pedidos-online',
    ]);
  });
});

describe('rutaInicialAdmin', () => {
  it('manda a cada rol a su pantalla de trabajo', () => {
    expect(rutaInicialAdmin('owner')).toBe('/admin');
    expect(rutaInicialAdmin('admin')).toBe('/admin');
    expect(rutaInicialAdmin('cocina')).toBe('/admin/cocina');
    expect(rutaInicialAdmin('mozo')).toBe('/admin/mesas');
    expect(rutaInicialAdmin('cajero')).toBe('/admin/caja');
  });
});
