// lib/socket-client.ts

import type { Socket } from 'socket.io-client';

/*
Frontend Socket Connection with Authentication

socket.io-client is loaded lazily via dynamic import() so its
~45KB bundle is only fetched on pages that actually open a
socket connection (e.g. task detail CommentBox) instead of
every page that transitively imports this module.
*/

let socketPromise: Promise<Socket> | null = null;

export async function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = (async () => {
      const { io } = await import('socket.io-client');

      // The HttpOnly `token` cookie cannot be read via document.cookie.
      // The Socket.IO handshake sends cookies automatically and the
      // server extracts the token from the Cookie header — no client
      // token is needed here.
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
      });

      return socket;
    })();
  }

  return socketPromise;
}

export default getSocket;
