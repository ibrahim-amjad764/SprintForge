// hooks/useNotifications.ts
'use client';

import { useEffect, useState } from 'react';

export default function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch(`/api/notifications?user=${userId}`)
      .then((res) => res.json())
      .then((data) => setNotifications(data.data));
  }, [userId]);

  return notifications;
}
