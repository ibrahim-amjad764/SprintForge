// components/time/Timer.tsx

'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function Timer({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}) {
  const [timerId, setTimerId] = useState<string | null>(null);

  async function start() {
    const response = await apiRequest(
      '/api/time',

      {
        method: 'POST',
        body: JSON.stringify({
          task: taskId,
          user: userId,
        }),
      }
    );
    setTimerId(response.data._id);
  }

  async function stop() {
    if (!timerId) return;

    await apiRequest(`/api/time/${timerId}`, { method: 'PUT' });
    setTimerId(null);
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={start}
        className="rounded bg-green-600 px-4 py-2 text-white"
      >
        {' '}
        Start
      </button>

      <button
        onClick={stop}
        className="rounded bg-red-600 px-4 py-2 text-white"
      >
        {' '}
        Stop
      </button>
    </div>
  );
}
