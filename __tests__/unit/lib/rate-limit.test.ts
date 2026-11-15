import { describe, it, expect } from '@jest/globals';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    expect(rateLimit('t1:a', 3, 60_000)).toBe(true);
    expect(rateLimit('t1:a', 3, 60_000)).toBe(true);
    expect(rateLimit('t1:a', 3, 60_000)).toBe(true);
  });

  it('blocks the request that exceeds the limit', () => {
    expect(rateLimit('t1:b', 2, 60_000)).toBe(true);
    expect(rateLimit('t1:b', 2, 60_000)).toBe(true);
    expect(rateLimit('t1:b', 2, 60_000)).toBe(false);
    expect(rateLimit('t1:b', 2, 60_000)).toBe(false);
  });

  it('allows requests again after the window expires', async () => {
    expect(rateLimit('t1:c', 1, 30)).toBe(true);
    expect(rateLimit('t1:c', 1, 30)).toBe(false);

    await sleep(40);

    expect(rateLimit('t1:c', 1, 30)).toBe(true);
  });

  it('tracks keys independently', () => {
    expect(rateLimit('t1:d1', 1, 60_000)).toBe(true);
    expect(rateLimit('t1:d1', 1, 60_000)).toBe(false);
    expect(rateLimit('t1:d2', 1, 60_000)).toBe(true);
  });

  it('uses default limit of 100 per minute', () => {
    for (let i = 0; i < 100; i++) {
      expect(rateLimit('t1:e')).toBe(true);
    }
    expect(rateLimit('t1:e')).toBe(false);
  });

  it('evicts the oldest bucket when the map is full', () => {
    // MAX_BUCKETS is 10_000. Fill: victim + 9_999 fresh keys = 10_000.
    // The next insert triggers eviction of the oldest key ('victim').
    rateLimit('t1:evict-victim', 1, 60_000);

    for (let i = 0; i < 9_999; i++) {
      rateLimit(`t1:evict-fill-${i}`, 1, 60_000);
    }

    // This call sees size === MAX_BUCKETS → evicts 'victim' (oldest).
    rateLimit('t1:evict-trigger', 1, 60_000);

    // Victim was evicted → fresh bucket → allowed again.
    expect(rateLimit('t1:evict-victim', 1, 60_000)).toBe(true);

    // A recently-inserted key is still tracked → still limited.
    expect(rateLimit('t1:evict-trigger', 1, 60_000)).toBe(false);
  });
});

describe('getClientIP', () => {
  const req = (headers: Record<string, string>) =>
    ({ headers: new Headers(headers) }) as { headers: Headers };

  it('prefers x-vercel-forwarded-for', () => {
    expect(
      getClientIP(
        req({
          'x-vercel-forwarded-for': '1.1.1.1, 2.2.2.2',
          'x-real-ip': '3.3.3.3',
          'x-forwarded-for': '9.9.9.9',
        }),
      ),
    ).toBe('1.1.1.1');
  });

  it('falls back to x-real-ip', () => {
    expect(
      getClientIP(req({ 'x-real-ip': '3.3.3.3', 'x-forwarded-for': '9.9.9.9' })),
    ).toBe('3.3.3.3');
  });

  it('uses the rightmost x-forwarded-for entry (nearest proxy)', () => {
    expect(getClientIP(req({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }))).toBe(
      '7.7.7.7',
    );
  });

  it("returns 'unknown' when no forwarding headers exist", () => {
    expect(getClientIP(req({}))).toBe('unknown');
  });
});
