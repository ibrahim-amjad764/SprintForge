import { describe, it, expect, afterEach } from '@jest/globals';
import { buildAuthCookie } from '@/lib/auth';

describe('buildAuthCookie', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('sets HttpOnly, Path, Max-Age and SameSite=Lax', () => {
    const cookie = buildAuthCookie('tok123', 604800);

    expect(cookie).toContain('token=tok123');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=604800');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('omits Secure outside production (localhost dev keeps working)', () => {
    process.env.NODE_ENV = 'development';
    const cookie = buildAuthCookie('tok123', 604800);

    expect(cookie).not.toContain('Secure');
  });

  it('adds Secure in production', () => {
    process.env.NODE_ENV = 'production';
    const cookie = buildAuthCookie('tok123', 604800);

    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('HttpOnly');
  });

  it('builds a clearing cookie for logout (Max-Age=0)', () => {
    const cookie = buildAuthCookie('', 0);

    expect(cookie).toContain('token=;');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
});
