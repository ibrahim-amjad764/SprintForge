// server/socket.ts
import { Server, Socket } from 'socket.io';
import { verifyToken } from '@/lib/auth';
import logger from '@/lib/logger';
import {
  isWorkspaceMember,
  getMembershipForProject,
} from '@/lib/authorization';
import {
  assertTokenVersion,
  extractTokenVersion,
} from '@/lib/session';

/*
Socket.IO Server
Responsible for:
- Authenticated connections
- Room management (user, workspace, project)
- Event broadcasting
*/

// The io instance is stored on globalThis, not a module variable:
// instrumentation.ts and route handlers can be bundled into separate
// webpack runtimes, each getting its own module instance. globalThis
// is shared across them, so getIO() works from API routes regardless
// of which bundle initialized the server.
const globalForSocket = globalThis as unknown as { __socketIO?: Server };

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tokenVersion?: number;
}

/*
    Extract the session token from the handshake.

    Order:
    1. auth.token  — explicit client-provided token
    2. Authorization: Bearer header
    3. Cookie header — the HttpOnly `token` cookie is sent by the
       browser on the Socket.IO handshake, so server-side parsing
       preserves HttpOnly protection (document.cookie cannot read it).
*/
function extractToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken) return authToken;

  const authHeader = socket.handshake.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = socket.handshake.headers?.cookie;
  if (typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

export function initSocket(server: any) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
  });
  globalForSocket.__socketIO = io;

  io.use(async (socket: any, next) => {
    try {
      const token = extractToken(socket);

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const payload = await verifyToken(token);
      if (!payload || !payload.userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      // DB-backed session check: reject revoked tokens (tokenVersion
      // mismatch) and malformed version claims on new connections.
      const tokenVersion = extractTokenVersion(payload);
      if (
        tokenVersion === null ||
        !(await assertTokenVersion(String(payload.userId), tokenVersion))
      ) {
        return next(new Error('Authentication error: Session revoked'));
      }

      socket.userId = payload.userId;
      socket.tokenVersion = tokenVersion;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`User connected: ${socket.userId} (${socket.id})`);

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.userId}`);

    // Room management — membership is verified server-side so a user
    // cannot join rooms for workspaces/projects they cannot access.
    // Session version is re-validated on every join so a revoked
    // token cannot keep acquiring room access on a live socket.
    const sessionStillValid = async (socket: AuthenticatedSocket) => {
      const valid = await assertTokenVersion(
        socket.userId!,
        socket.tokenVersion ?? 0,
      );
      if (!valid) {
        logger.info(`User ${socket.userId} session revoked — disconnecting`);
        socket.disconnect(true);
      }
      return valid;
    };

    socket.on('join-workspace', async (workspaceId: string) => {
      if (typeof workspaceId !== 'string' || !workspaceId) return;
      if (!(await sessionStillValid(socket))) return;
      const allowed = await isWorkspaceMember(workspaceId, socket.userId!);
      if (!allowed) {
        logger.info(`User ${socket.userId} denied workspace:${workspaceId}`);
        return;
      }
      socket.join(`workspace:${workspaceId}`);
      logger.info(`User ${socket.userId} joined workspace:${workspaceId}`);
    });

    socket.on('leave-workspace', (workspaceId: string) => {
      socket.leave(`workspace:${workspaceId}`);
      logger.info(`User ${socket.userId} left workspace:${workspaceId}`);
    });

    socket.on('join-project', async (projectId: string) => {
      if (typeof projectId !== 'string' || !projectId) return;
      if (!(await sessionStillValid(socket))) return;
      const membership = await getMembershipForProject(projectId, socket.userId!);
      if (!membership) {
        logger.info(`User ${socket.userId} denied project:${projectId}`);
        return;
      }
      socket.join(`project:${projectId}`);
      logger.info(`User ${socket.userId} joined project:${projectId}`);
    });

    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.info(`User ${socket.userId} left project:${projectId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

export function getIO() {
  return globalForSocket.__socketIO;
}
