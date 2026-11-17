import mongoose from 'mongoose';
import * as Sentry from '@sentry/nextjs';
import logger from '@/lib/logger';
import { getIO } from '@/server/socket';
import { getSocketHttpServer } from '@/server/bootstrap';
import {
  installGracefulShutdown,
  gracefulShutdown,
} from '@/server/lifecycle';

jest.mock('mongoose', () => ({
  disconnect: jest.fn(() => Promise.resolve()),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  flush: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    debug: jest.fn(),
    flush: jest.fn(),
  },
}));

jest.mock('@/server/socket', () => ({
  getIO: jest.fn(),
}));

jest.mock('@/server/bootstrap', () => ({
  getSocketHttpServer: jest.fn(),
}));

const g = globalThis as unknown as {
  __shutdownPromise?: Promise<void>;
  __lifecycleHandlersInstalled?: boolean;
};

const mockGetIO = getIO as jest.Mock;
const mockGetHttp = getSocketHttpServer as jest.Mock;
const mockDisconnect = mongoose.disconnect as jest.Mock;
const mockCapture = Sentry.captureException as jest.Mock;
const mockFlush = Sentry.flush as jest.Mock;
const mockLogFlush = logger.flush as jest.Mock;
const mockLogInfo = logger.info as jest.Mock;
const mockLogError = logger.error as jest.Mock;

function fakeIo(closeImpl?: (cb: () => void) => void) {
  return { close: jest.fn((cb: () => void) => (closeImpl ?? ((c) => c()))(cb)) };
}

function fakeHttpServer(closeImpl?: (cb: (err?: Error) => void) => void) {
  return {
    close: jest.fn((cb: (err?: Error) => void) =>
      (closeImpl ?? ((c) => c()))(cb)
    ),
  };
}

beforeEach(() => {
  delete g.__shutdownPromise;
  delete g.__lifecycleHandlersInstalled;
  jest.clearAllMocks();
  mockGetIO.mockReturnValue(undefined);
  mockGetHttp.mockReturnValue(undefined);
  mockDisconnect.mockResolvedValue(undefined);
  mockFlush.mockResolvedValue(true);
});

describe('gracefulShutdown', () => {
  it('runs cleanup in order: io.close → httpServer.close → mongoose.disconnect → sentry.flush → logger.flush', async () => {
    const order: string[] = [];
    const io = fakeIo((cb) => {
      order.push('io.close');
      cb();
    });
    const httpServer = fakeHttpServer((cb) => {
      order.push('http.close');
      cb();
    });
    mockGetIO.mockReturnValue(io);
    mockGetHttp.mockReturnValue(httpServer);
    mockDisconnect.mockImplementation(() => {
      order.push('mongoose.disconnect');
      return Promise.resolve();
    });
    mockFlush.mockImplementation(() => {
      order.push('sentry.flush');
      return Promise.resolve(true);
    });
    mockLogFlush.mockImplementation(() => order.push('logger.flush'));

    await gracefulShutdown('SIGTERM');

    expect(order).toEqual([
      'io.close',
      'http.close',
      'mongoose.disconnect',
      'sentry.flush',
      'logger.flush',
    ]);
    expect(mockLogInfo).toHaveBeenCalledWith(
      { signal: 'SIGTERM' },
      'Graceful shutdown initiated'
    );
  });

  it('is idempotent — repeated signals share one shutdown and cleanup runs once', async () => {
    const io = fakeIo();
    mockGetIO.mockReturnValue(io);
    mockGetHttp.mockReturnValue(fakeHttpServer());

    const p1 = gracefulShutdown('SIGTERM');
    const p2 = gracefulShutdown('SIGINT');
    expect(p2).toBe(p1);
    await Promise.all([p1, p2]);

    expect(io.close).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('tolerates absent socket server (port-conflict fallback) and still cleans up', async () => {
    mockGetIO.mockReturnValue(undefined);
    mockGetHttp.mockReturnValue(undefined);

    await gracefulShutdown('SIGTERM');

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(mockLogFlush).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('continues cleanup when Socket.IO close throws', async () => {
    const io = { close: jest.fn(() => { throw new Error('io boom'); }) };
    mockGetIO.mockReturnValue(io);
    mockGetHttp.mockReturnValue(fakeHttpServer());

    await gracefulShutdown('SIGTERM');

    expect(mockCapture).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('continues cleanup when mongoose.disconnect rejects', async () => {
    mockGetIO.mockReturnValue(fakeIo());
    mockGetHttp.mockReturnValue(fakeHttpServer());
    mockDisconnect.mockRejectedValue(new Error('mongo boom'));

    await gracefulShutdown('SIGTERM');

    expect(mockCapture).toHaveBeenCalled();
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(mockLogFlush).toHaveBeenCalledTimes(1);
  });

  it('still flushes logs when sentry.flush rejects', async () => {
    mockGetIO.mockReturnValue(fakeIo());
    mockGetHttp.mockReturnValue(fakeHttpServer());
    mockFlush.mockRejectedValue(new Error('sentry boom'));

    await gracefulShutdown('SIGTERM');

    expect(mockLogError).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Sentry flush failed during shutdown'
    );
    expect(mockLogFlush).toHaveBeenCalledTimes(1);
  });

  it('does not hang on a never-closing http server within the timeout budget', async () => {
    // httpServer.close callback never fires → gracefulShutdown promise
    // stays pending, but the armed force timer is what guarantees exit.
    // We verify the promise remains pending and cleanup ordering
    // proceeded up to the hang point.
    jest.useFakeTimers();
    try {
      const hanging = { close: jest.fn(() => { /* never calls cb */ }) };
      mockGetIO.mockReturnValue(fakeIo());
      mockGetHttp.mockReturnValue(hanging);

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const p = gracefulShutdown('SIGTERM');
      let settled = false;
      void p.then(() => { settled = true; });

      await jest.advanceTimersByTimeAsync(10_000);

      expect(settled).toBe(false);
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockDisconnect).not.toHaveBeenCalled(); // still blocked upstream
      exitSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('installGracefulShutdown', () => {
  // Jest's node environment does not register real signal listeners
  // (process.on('SIGTERM') is a no-op for listenerCount), so we spy
  // on process.on to verify what install() attempts to register.
  let onSpy: jest.SpyInstance;

  beforeEach(() => {
    onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    onSpy.mockRestore();
  });

  function registeredSignals(): string[] {
    return onSpy.mock.calls.map((c) => String(c[0]));
  }

  it('does not install handlers under Jest (NODE_ENV=test)', () => {
    installGracefulShutdown();
    expect(onSpy).not.toHaveBeenCalled();
  });

  it('installs SIGTERM/SIGINT + rejection/exception handlers once when not in test env', () => {
    const env = process.env;
    const workerId = env.JEST_WORKER_ID;
    const nodeEnv = env.NODE_ENV;
    try {
      delete env.JEST_WORKER_ID;
      env.NODE_ENV = 'production';

      installGracefulShutdown();
      const first = registeredSignals();
      installGracefulShutdown();
      const second = registeredSignals();

      expect(first.sort()).toEqual([
        'SIGINT',
        'SIGTERM',
        'uncaughtException',
        'unhandledRejection',
      ]);
      expect(second.sort()).toEqual(first); // idempotent — no duplicate calls
      expect(g.__lifecycleHandlersInstalled).toBe(true);
    } finally {
      env.JEST_WORKER_ID = workerId;
      env.NODE_ENV = nodeEnv;
    }
  });
});
