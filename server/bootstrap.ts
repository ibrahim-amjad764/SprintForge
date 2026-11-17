// server/bootstrap.ts
//
// Socket.IO server bootstrap — runs inside the Next.js server
// process via instrumentation.ts register().
//
// Socket.IO gets its own http.Server on a dedicated port
// (SOCKET_PORT, default 3001). NEXT_PUBLIC_SOCKET_URL must point
// at that endpoint. API routes share the process, so getIO()
// emits reach connected clients.
//
// SINGLE-INSTANCE DEPLOYMENT: Socket.IO rooms and the in-memory
// rate limiter are per-process. Run exactly ONE app instance, or
// add a Redis adapter + sticky sessions before scaling horizontally.

import http from 'http';
import { initSocket } from './socket';
import logger from '@/lib/logger';

const globalForSocket = globalThis as unknown as {
  __socketHttpServer?: http.Server;
};

export async function startSocketServer(): Promise<http.Server | null> {
  // register() can run more than once in dev (HMR) — never
  // double-listen on the port.
  if (globalForSocket.__socketHttpServer) {
    return globalForSocket.__socketHttpServer;
  }

  const port = Number(process.env.SOCKET_PORT || 3001);

  const server = http.createServer((_req, res) => {
    // Socket.IO intercepts /socket.io/* before this handler.
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  initSocket(server);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => resolve());
    });
  } catch (error) {
    // A busy port must not take down the Next.js app — realtime
    // degrades, everything else keeps working.
    logger.error({ err: error }, `[Socket] Failed to listen on port ${port}:`);
    return null;
  }

  globalForSocket.__socketHttpServer = server;
  logger.info(`[Socket] Socket.IO server listening on port ${port}`);
  return server;
}

// Graceful shutdown needs the same handle — stored on globalThis
// because instrumentation and route bundles can be split.
export function getSocketHttpServer(): http.Server | undefined {
  return globalForSocket.__socketHttpServer;
}
