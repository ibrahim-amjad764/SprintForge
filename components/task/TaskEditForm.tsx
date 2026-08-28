// components / task / TaskEditForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

interface Props { task: any }

export default function TaskEditForm({ task }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    await apiRequest( `/api/tasks/${task._id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
        }),
      }
    );

    router.push('./..');
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-xl space-y-5"
    >
      <h1 className="text-3xl font-bold">Edit Task</h1>
      <input
        className="w-full border p-3"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className="w-full border p-3"
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button className="rounded bg-black px-5 py-3 text-white">
        Save Changes
      </button>
    </form>
  );
}
