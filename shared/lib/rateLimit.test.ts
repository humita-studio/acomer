import { describe, expect, it, beforeEach } from 'vitest';
import { rateLimit, _resetRateLimitForTests } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => _resetRateLimitForTests());

  it('permite hasta el límite y luego bloquea', () => {
    expect(rateLimit('k', 2, 60_000).ok).toBe(true);
    expect(rateLimit('k', 2, 60_000).ok).toBe(true);
    const blocked = rateLimit('k', 2, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('aisla claves distintas', () => {
    expect(rateLimit('a', 1, 60_000).ok).toBe(true);
    expect(rateLimit('b', 1, 60_000).ok).toBe(true);
    expect(rateLimit('a', 1, 60_000).ok).toBe(false);
  });
});
