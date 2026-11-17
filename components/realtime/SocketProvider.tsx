// components/realtime/SocketProvider.tsx

'use client';

import { createContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
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
    let cancelled = false;
    let socketInstance: Socket | null = null;

    getSocket().then((instance) => {
      if (cancelled) return;
      socketInstance = instance;
      setSocket(instance);

      instance.on('connect', () => {
        setIsConnected(true);
        console.log('Socket connected');
      });

      instance.on('disconnect', () => {
        setIsConnected(false);
        console.log('Socket disconnected');
      });
    });

    return () => {
      cancelled = true;
      socketInstance?.off('connect');
      socketInstance?.off('disconnect');
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
