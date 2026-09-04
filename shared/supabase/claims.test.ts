import { describe, expect, it, vi } from 'vitest';
import { getVerifiedUser } from './claims';

function clientConClaims(claims: Record<string, unknown> | null, error: unknown = null) {
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: claims ? { claims, header: {}, signature: new Uint8Array() } : null,
        error,
      })),
    },
  } as unknown as Parameters<typeof getVerifiedUser>[0];
}

describe('getVerifiedUser', () => {
  it('mapea sub/email/aud y la metadata de contraseña temporal', async () => {
    const user = await getVerifiedUser(
      clientConClaims({
        sub: 'usr-1',
        email: 'mozo@local.com',
        aud: 'authenticated',
        user_metadata: { must_change_password: true },
      }),
    );
    expect(user).toEqual({
      id: 'usr-1',
      email: 'mozo@local.com',
      aud: 'authenticated',
      mustChangePassword: true,
    });
  });

  it('tolera aud como array y metadata ausente', async () => {
    const user = await getVerifiedUser(
      clientConClaims({ sub: 'usr-2', aud: ['authenticated', 'otra'] }),
    );
    expect(user?.aud).toBe('authenticated');
    expect(user?.email).toBe('');
    expect(user?.mustChangePassword).toBe(false);
  });

  it('devuelve null sin sesión, con error o sin sub', async () => {
    expect(await getVerifiedUser(clientConClaims(null))).toBeNull();
    expect(await getVerifiedUser(clientConClaims({ sub: 'x' }, new Error('boom')))).toBeNull();
    expect(await getVerifiedUser(clientConClaims({ email: 'sin-sub@x.com' }))).toBeNull();
  });
});
