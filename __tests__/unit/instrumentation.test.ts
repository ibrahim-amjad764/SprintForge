// __tests__/unit/instrumentation.test.ts
//
// Verifies the DISABLE_SOCKET_SERVER guard in instrumentation.ts:
// the dedicated Socket.IO server must be skipped on hosts that set
// the flag (e.g. Netlify), while remaining fully functional elsewhere.

const startSocketServer = jest.fn<() => Promise<null>>().mockResolvedValue(null);
const installGracefulShutdown = jest.fn();

jest.mock('@/server/bootstrap', () => ({
  startSocketServer: () => startSocketServer(),
}));
jest.mock('@/server/lifecycle', () => ({
  installGracefulShutdown: () => installGracefulShutdown(),
}));
jest.mock('@/sentry.server.config', () => ({}));
jest.mock('@/sentry.edge.config', () => ({}));

import { register } from '@/instrumentation';

describe('instrumentation register()', () => {
  const originalRuntime = process.env.NEXT_RUNTIME;
  const originalFlag = process.env.DISABLE_SOCKET_SERVER;

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
    if (originalFlag === undefined) {
      delete process.env.DISABLE_SOCKET_SERVER;
    } else {
      process.env.DISABLE_SOCKET_SERVER = originalFlag;
    }
    jest.clearAllMocks();
  });

  it('starts the socket server on nodejs runtime when flag is absent', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    delete process.env.DISABLE_SOCKET_SERVER;

    await register();

    expect(startSocketServer).toHaveBeenCalledTimes(1);
    expect(installGracefulShutdown).toHaveBeenCalledTimes(1);
  });

  it('skips the socket server when DISABLE_SOCKET_SERVER=true', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.DISABLE_SOCKET_SERVER = 'true';

    await register();

    expect(startSocketServer).not.toHaveBeenCalled();
    // Graceful shutdown still installs — it also owns mongoose/Sentry
    // cleanup and is harmless on serverless.
    expect(installGracefulShutdown).toHaveBeenCalledTimes(1);
  });

  it('only skips on exact "true" — other values keep socket enabled', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.DISABLE_SOCKET_SERVER = '1';

    await register();

    expect(startSocketServer).toHaveBeenCalledTimes(1);
  });

  it('does nothing on edge runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    delete process.env.DISABLE_SOCKET_SERVER;

    await register();

    expect(startSocketServer).not.toHaveBeenCalled();
    expect(installGracefulShutdown).not.toHaveBeenCalled();
  });
});
