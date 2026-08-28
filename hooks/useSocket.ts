// hooks/useSocket.ts
'use client';

import { useContext } from 'react';
import { SocketContext } from '@/components/realtime/SocketProvider';

export default function useSocket() {
  return useContext(SocketContext);
}
