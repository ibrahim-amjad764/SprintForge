import http from 'http';

jest.mock('@/server/socket', () => ({
  initSocket: jest.fn(),
}));

import { initSocket } from '@/server/socket';
import { startSocketServer } from '@/server/bootstrap';
import logger from '@/lib/logger';

describe('startSocketServer', () => {
  const originalPort = process.env.SOCKET_PORT;

  afterEach(async () => {
    process.env.SOCKET_PORT = originalPort;
    const g = globalThis as unknown as { __socketHttpServer?: http.Server };
    if (g.__socketHttpServer) {
      await new Promise<void>((resolve) => g.__socketHttpServer!.close(() => resolve()));
      delete g.__socketHttpServer;
    }
    jest.clearAllMocks();
  });

  it('creates an http server, initializes socket.io, and listens', async () => {
    process.env.SOCKET_PORT = '0'; // ephemeral port for tests
    const server = await startSocketServer();

    expect(server).toBeInstanceOf(http.Server);
    expect(initSocket).toHaveBeenCalledTimes(1);
    expect(initSocket).toHaveBeenCalledWith(server);
    expect(server!.listening).toBe(true);
  });

  it('is idempotent — a second call returns the same server without re-listening', async () => {
    process.env.SOCKET_PORT = '0';
    const first = await startSocketServer();
    const second = await startSocketServer();

    expect(second).toBe(first);
    expect(initSocket).toHaveBeenCalledTimes(1);
  });

  it('returns null instead of throwing when the port is unavailable', async () => {
    // Occupy a port, then try to bind the same one.
    const blocker = http.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, resolve));
    const port = (blocker.address() as { port: number }).port;
    process.env.SOCKET_PORT = String(port);

    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const server = await startSocketServer();

    expect(server).toBeNull();
    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();

    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  });
});
