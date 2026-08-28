// components/realtime/OnlineUsers.tsx

'use client';

import { useEffect, useState } from 'react';
import useSocket from '@/hooks/useSocket';

export default function OnlineUsers() {
  const socket = useSocket();

  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on(
      'online-users',

      (data) => {
        setUsers(data);
      }
    );

    return () => {
      socket.off('online-users');
    };
  }, [socket]);

  return (
    <div>
      <h3 className="font-bold">Online Members</h3>

      {users.map((user: any) => (
        <p key={user.id}>🟢 {user.name}</p>
      ))}
    </div>
  );
}
