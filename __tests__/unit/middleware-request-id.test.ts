import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe('middleware request id', () => {
  it('generates a server-side x-request-id on API routes', async () => {
    const res = await middleware(makeRequest('/api/tasks'));
    const id = res.headers.get('x-request-id');
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('overwrites a client-supplied x-request-id', async () => {
    const res = await middleware(
      makeRequest('/api/tasks', { 'x-request-id': 'forged-by-client' })
    );
    const id = res.headers.get('x-request-id');
    expect(id).not.toBe('forged-by-client');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('forwards the request id to downstream handlers', async () => {
    const res = await middleware(makeRequest('/api/tasks'));
    // Next.js forwards overridden request headers to route handlers via
    // x-middleware-request-* response headers.
    const forwarded = res.headers.get('x-middleware-request-x-request-id');
    expect(forwarded).toMatch(/^[0-9a-f-]{36}$/);
    expect(forwarded).toBe(res.headers.get('x-request-id'));
  });

  it('does not forward the client-supplied id downstream', async () => {
    const res = await middleware(
      makeRequest('/api/tasks', { 'x-request-id': 'forged-by-client' })
    );
    const forwarded = res.headers.get('x-middleware-request-x-request-id');
    expect(forwarded).not.toBe('forged-by-client');
    expect(forwarded).toMatch(/^[0-9a-f-]{36}$/);
  });
});
