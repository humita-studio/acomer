import { describe, expect, it } from 'vitest';
import { extractTenantSlug } from './tenant-host';

describe('extractTenantSlug', () => {
  it('extrae slug con puerto en host y main (dev)', () => {
    expect(extractTenantSlug('nonna-raffaela.localhost:3000', 'localhost:3000')).toBe(
      'nonna-raffaela',
    );
  });

  it('extrae slug si el Host no trae puerto', () => {
    expect(extractTenantSlug('nonna-raffaela.localhost', 'localhost:3000')).toBe(
      'nonna-raffaela',
    );
  });

  it('extrae slug en prod sin puerto', () => {
    expect(extractTenantSlug('pizzeria.acomer.com.ar', 'acomer.com.ar')).toBe('pizzeria');
  });

  it('devuelve null en apex / www / app', () => {
    expect(extractTenantSlug('localhost:3000', 'localhost:3000')).toBeNull();
    expect(extractTenantSlug('www.acomer.com.ar', 'acomer.com.ar')).toBeNull();
    expect(extractTenantSlug('app.acomer.com.ar', 'acomer.com.ar')).toBeNull();
  });

  it('devuelve null en vercel.app', () => {
    expect(extractTenantSlug('acomer-git-main.vercel.app', 'acomer.com.ar')).toBeNull();
  });
});
