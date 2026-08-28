// components/admin/AdminDashboard.tsx

'use client';

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.data));
  }, []);

  return (
    <div>
      <h2 className="mb-5 font-bold">Users</h2>

      {users.map((user) => (
        <div
          key={user._id}
          className="border p-3"
        >
          {user.name}-{user.role}
        </div>
      ))}
    </div>
  );
}
