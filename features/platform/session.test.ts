import { describe, expect, it } from 'vitest';
import { isPlatformAdminEmail, parsePlatformAdminEmails } from './platformAllowlist';

describe('parsePlatformAdminEmails', () => {
  it('devuelve set vacío si raw es vacío o undefined', () => {
    expect(parsePlatformAdminEmails(undefined).size).toBe(0);
    expect(parsePlatformAdminEmails(null).size).toBe(0);
    expect(parsePlatformAdminEmails('').size).toBe(0);
    expect(parsePlatformAdminEmails('   ').size).toBe(0);
  });

  it('parsea coma-separado, trim y lowercase', () => {
    const set = parsePlatformAdminEmails('  A@Acomer.com , ops@acomer.com,  ');
    expect(set.has('a@acomer.com')).toBe(true);
    expect(set.has('ops@acomer.com')).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe('isPlatformAdminEmail', () => {
  const allow = 'dueño@acomer.com, Ops@Acomer.com';

  it('matchea case-insensitive y con trim', () => {
    expect(isPlatformAdminEmail('DUEÑO@acomer.com', allow)).toBe(true);
    expect(isPlatformAdminEmail('  ops@acomer.com  ', allow)).toBe(true);
  });

  it('rechaza emails fuera de la lista o vacíos', () => {
    expect(isPlatformAdminEmail('otro@mail.com', allow)).toBe(false);
    expect(isPlatformAdminEmail('', allow)).toBe(false);
    expect(isPlatformAdminEmail(null, allow)).toBe(false);
    expect(isPlatformAdminEmail('ops@acomer.com', '')).toBe(false);
  });
});
