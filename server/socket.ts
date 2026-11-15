// server/socket.ts
import { Server, Socket } from 'socket.io';
import { verifyToken } from '@/lib/auth';
import {
  isWorkspaceMember,
  getMembershipForProject,
} from '@/lib/authorization';

/*
Socket.IO Server
Responsible for:
- Authenticated connections
- Room management (user, workspace, project)
- Event broadcasting
*/

let io: Server;

interface AuthenticatedSocket extends Socket {
  userId?: string;
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
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

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

      socket.userId = payload.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId} (${socket.id})`);

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.userId}`);

    // Room management — membership is verified server-side so a user
    // cannot join rooms for workspaces/projects they cannot access.
    socket.on('join-workspace', async (workspaceId: string) => {
      if (typeof workspaceId !== 'string' || !workspaceId) return;
      const allowed = await isWorkspaceMember(workspaceId, socket.userId!);
      if (!allowed) {
        console.log(`User ${socket.userId} denied workspace:${workspaceId}`);
        return;
      }
      socket.join(`workspace:${workspaceId}`);
      console.log(`User ${socket.userId} joined workspace:${workspaceId}`);
    });

    socket.on('leave-workspace', (workspaceId: string) => {
      socket.leave(`workspace:${workspaceId}`);
      console.log(`User ${socket.userId} left workspace:${workspaceId}`);
    });

    socket.on('join-project', async (projectId: string) => {
      if (typeof projectId !== 'string' || !projectId) return;
      const membership = await getMembershipForProject(projectId, socket.userId!);
      if (!membership) {
        console.log(`User ${socket.userId} denied project:${projectId}`);
        return;
      }
      socket.join(`project:${projectId}`);
      console.log(`User ${socket.userId} joined project:${projectId}`);
    });

    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`User ${socket.userId} left project:${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}
