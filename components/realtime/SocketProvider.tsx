// components/realtime/SocketProvider.tsx

'use client';

import { createContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import getSocket from '@/lib/socket-client';

export const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
}

export default function SocketProvider({ 
  children, 
  userId, 
  workspaceId, 
  projectId 
}: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = getSocket();
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    return () => {
      socketInstance.off('connect');
      socketInstance.off('disconnect');
    };
  }, []);

  // Join rooms when IDs change
  useEffect(() => {
    if (!socket || !isConnected) return;

    if (workspaceId) {
      socket.emit('join-workspace', workspaceId);
    }

    if (projectId) {
      socket.emit('join-project', projectId);
    }

    return () => {
      if (workspaceId) {
        socket.emit('leave-workspace', workspaceId);
      }
      if (projectId) {
        socket.emit('leave-project', projectId);
      }
    };
  }, [socket, isConnected, workspaceId, projectId]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
