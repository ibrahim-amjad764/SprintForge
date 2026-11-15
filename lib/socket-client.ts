// lib/socket-client.ts

import { io, Socket } from 'socket.io-client';

/*
Frontend Socket Connection with Authentication
*/

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    // The HttpOnly `token` cookie cannot be read via document.cookie.
    // The Socket.IO handshake sends cookies automatically and the
    // server extracts the token from the Cookie header — no client
    // token is needed here.
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }

  return socket;
}

export default getSocket;
