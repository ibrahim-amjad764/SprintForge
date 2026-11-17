// server/lifecycle.ts
//
// Graceful shutdown for the production Node.js process.
//
// OWNERSHIP MODEL (verified against next@16 start-server.js):
// - `next start` creates and owns the primary HTTP server. Its
//   built-in SIGINT/SIGTERM handlers call server.close() (drains
//   in-flight requests — but with NO timeout) then process.exit(143).
//   That server handle is module-local and unreachable from
//   instrumentation, so we cannot (and must not) take over with
//   NEXT_MANUAL_SIG_HANDLE — doing so would lose the HTTP drain.
// - We own: the Socket.IO http.Server on SOCKET_PORT, the Socket.IO
//   Server instance, and the cached Mongoose connection.
//
// DESIGN: our signal handlers run ALONGSIDE Next's. We perform our
// cleanup concurrently while Next drains HTTP, and we arm a bounded
// force-exit timer — which also fixes Next's missing shutdown
// timeout if a keep-alive connection hangs the drain. We do NOT call
// process.exit() on the success path: Next's handler owns exit-code
// semantics (143/130). The force timer exits(1) only as a last resort.
//
// Guards: never installs in Jest; globalThis flag makes install
// idempotent across dev HMR / repeated register() calls.

import mongoose from 'mongoose';
import * as Sentry from '@sentry/nextjs';
import logger from '@/lib/logger';
import { getIO } from './socket';
import { getSocketHttpServer } from './bootstrap';

const globalForLifecycle = globalThis as unknown as {
  __shutdownPromise?: Promise<void>;
  __lifecycleHandlersInstalled?: boolean;
};

// Total budget for our cleanup before forcing exit. Next's own
// HTTP drain runs concurrently and is not bounded by this — the
// force timer covers the whole process, not just our steps.
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);
const SENTRY_FLUSH_MS = 2000;

export function installGracefulShutdown(): void {
  // Jest must never install process handlers — tests emit signals
  // and spy on process.exit.
  if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
    return;
  }
  // register() can run again on dev-server restart / HMR — the
  // process persists, so handlers must not duplicate.
  if (globalForLifecycle.__lifecycleHandlersInstalled) {
    return;
  }
  globalForLifecycle.__lifecycleHandlersInstalled = true;

  const onSignal = (signal: NodeJS.Signals) => {
    void gracefulShutdown(signal);
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
    Sentry.captureException(reason);
    void Sentry.flush(SENTRY_FLUSH_MS).finally(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    Sentry.captureException(err);
    void Sentry.flush(SENTRY_FLUSH_MS).finally(() => process.exit(1));
  });
}

// Idempotent: repeated signals return the same in-flight promise.
// Cleanup steps run sequentially and independently — one subsystem
// failing must not skip the rest.
export function gracefulShutdown(signal: string): Promise<void> {
  if (globalForLifecycle.__shutdownPromise) {
    return globalForLifecycle.__shutdownPromise;
  }

  globalForLifecycle.__shutdownPromise = (async () => {
    logger.info({ signal }, 'Graceful shutdown initiated');

    // Last-resort guard: if anything (our cleanup OR Next's unbounded
    // HTTP drain) hangs, force exit. unref'd so the timer itself never
    // keeps a healthy process alive; it still fires while the loop runs.
    const forceTimer = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    try {
      // 1. Socket.IO first: io.close() disconnects every client and
      //    stops engine.io from accepting new handshakes; then the
      //    http.Server stops listening. Socket connections are
      //    long-lived, so server.close() would hang until clients
      //    drop — io.close() must come first.
      try {
        const io = getIO();
        if (io) {
          await new Promise<void>((resolve) => io.close(() => resolve()));
        }
      } catch (err) {
        logger.error({ err }, 'Socket.IO close failed during shutdown');
        Sentry.captureException(err);
      }

      try {
        const socketHttp = getSocketHttpServer();
        if (socketHttp) {
          await new Promise<void>((resolve) => socketHttp.close(() => resolve()));
        }
      } catch (err) {
        logger.error({ err }, 'Socket HTTP server close failed during shutdown');
        Sentry.captureException(err);
      }

      // 2. Mongoose — clean disconnect of the cached connection.
      try {
        await mongoose.disconnect();
      } catch (err) {
        logger.error({ err }, 'Mongoose disconnect failed during shutdown');
        Sentry.captureException(err);
      }

      // 3. Flush sinks. Pino's flush is synchronous; Sentry gets a
      //    bounded window so a slow network can't stall shutdown.
      try {
        await Sentry.flush(SENTRY_FLUSH_MS);
      } catch (err) {
        logger.error({ err }, 'Sentry flush failed during shutdown');
      }
      logger.flush();
      logger.info('Graceful shutdown cleanup complete — Next.js owns process exit');
    } finally {
      clearTimeout(forceTimer);
    }
  })();

  return globalForLifecycle.__shutdownPromise;
}
