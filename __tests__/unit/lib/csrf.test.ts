// __tests__/unit/lib/csrf.test.ts
import { describe, it, expect } from '@jest/globals';
import { isSameOriginMutation } from '@/lib/auth';

function req(opts: {
  method?: string;
  origin?: string;
  referer?: string;
  host?: string;
  nextUrlOrigin?: string;
}): Request {
  const headers = new Headers();
  if (opts.origin) headers.set('origin', opts.origin);
  if (opts.referer) headers.set('referer', opts.referer);
  if (opts.host) headers.set('host', opts.host);

  const r = new Request('http://localhost:3000/api/test', {
    method: opts.method ?? 'POST',
    headers,
  });

  // Simulate NextRequest.nextUrl when provided
  if (opts.nextUrlOrigin !== undefined) {
    Object.defineProperty(r, 'nextUrl', {
      value: { origin: opts.nextUrlOrigin },
    });
  }
  return r;
}

describe('isSameOriginMutation (CSRF Origin check)', () => {
  it('allows safe methods regardless of origin', () => {
    expect(
      isSameOriginMutation(
        req({ method: 'GET', origin: 'https://evil.com', nextUrlOrigin: 'http://localhost:3000' }),
      ),
    ).toBe(true);
  });

  it('allows same-origin POST', () => {
    expect(
      isSameOriginMutation(
        req({ method: 'POST', origin: 'http://localhost:3000', nextUrlOrigin: 'http://localhost:3000' }),
      ),
    ).toBe(true);
  });

  it('rejects cross-origin POST', () => {
    expect(
      isSameOriginMutation(
        req({ method: 'POST', origin: 'https://evil.com', nextUrlOrigin: 'http://localhost:3000' }),
      ),
    ).toBe(false);
  });

  it('rejects cross-origin PUT/PATCH/DELETE', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect(
        isSameOriginMutation(
          req({ method, origin: 'https://evil.com', nextUrlOrigin: 'http://localhost:3000' }),
        ),
      ).toBe(false);
    }
  });

  it('allows POST with no Origin/Referer (non-browser client)', () => {
    expect(
      isSameOriginMutation(
        req({ method: 'POST', nextUrlOrigin: 'http://localhost:3000' }),
      ),
    ).toBe(true);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(
      isSameOriginMutation(
        req({
          method: 'POST',
          referer: 'http://localhost:3000/dashboard',
          nextUrlOrigin: 'http://localhost:3000',
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        req({
          method: 'POST',
          referer: 'https://evil.com/page',
          nextUrlOrigin: 'http://localhost:3000',
        }),
      ),
    ).toBe(false);
  });

  it('uses Host header fallback when nextUrl is unavailable', () => {
    const r = req({ method: 'POST', origin: 'http://localhost:3000', host: 'localhost:3000' });
    expect(isSameOriginMutation(r)).toBe(true);

    const r2 = req({ method: 'POST', origin: 'https://evil.com', host: 'localhost:3000' });
    expect(isSameOriginMutation(r2)).toBe(false);
  });

  it('falls back to Host header for plain Request objects', () => {
    // undici strips the forbidden `host` header from real Request
    // objects, so simulate the runtime shape with a minimal mock —
    // this is the path login/register (plain Request handlers) take.
    const makeReq = (origin: string) =>
      ({
        method: 'POST',
        headers: {
          get: (h: string) =>
            h === 'host' ? 'localhost:3000' : h === 'origin' ? origin : null,
        },
      }) as unknown as Request;

    expect(isSameOriginMutation(makeReq('https://evil.com'))).toBe(false);
    expect(isSameOriginMutation(makeReq('http://localhost:3000'))).toBe(true);
  });
});
