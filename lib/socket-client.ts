// lib/socket-client.ts

import { io, Socket } from 'socket.io-client';

/*
Frontend Socket Connection with Authentication
*/

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    const token = typeof document !== 'undefined' 
      ? document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]
      : null;

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }

  return socket;
}

export default getSocket;
