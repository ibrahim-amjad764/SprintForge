jest.mock('mongoose', () => ({
  connection: { readyState: 1 },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
  },
}));

import mongoose from 'mongoose';
import { GET as healthGET } from '@/app/api/health/route';
import { GET as readyGET } from '@/app/api/ready/route';

const connection = mongoose.connection as unknown as { readyState: number };

describe('GET /api/health (liveness)', () => {
  it('returns 200 with ok status and no dependency checks', async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
    // Must not leak infrastructure details
    expect(body.checks).toBeUndefined();
  });
});

describe('GET /api/ready (readiness)', () => {
  afterEach(() => {
    connection.readyState = 1;
  });

  it('returns 200 ready when mongoose is connected', async () => {
    connection.readyState = 1;
    const res = await readyGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.checks.database).toBe('up');
  });

  it.each([0, 2, 3])(
    'returns 503 not_ready when readyState is %i',
    async (state) => {
      connection.readyState = state;
      const res = await readyGET();
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.status).toBe('not_ready');
      expect(body.checks.database).toBe('down');
    }
  );

  it('does not expose connection strings or host details', async () => {
    connection.readyState = 0;
    const res = await readyGET();
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/mongodb(\+srv)?:\/\//);
    expect(serialized).not.toMatch(/host|uri|secret/i);
  });
});
