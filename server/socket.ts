// server/socket.ts
import { Server, Socket } from 'socket.io';
import { verifyToken } from '@/lib/auth';

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

export function initSocket(server: any) {
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
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

    // Room management
    socket.on('join-workspace', (workspaceId: string) => {
      socket.join(`workspace:${workspaceId}`);
      console.log(`User ${socket.userId} joined workspace:${workspaceId}`);
    });

    socket.on('leave-workspace', (workspaceId: string) => {
      socket.leave(`workspace:${workspaceId}`);
      console.log(`User ${socket.userId} left workspace:${workspaceId}`);
    });

    socket.on('join-project', (projectId: string) => {
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
