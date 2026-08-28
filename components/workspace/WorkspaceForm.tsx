// components/workspace/WorkspaceForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function WorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const response = await apiRequest('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({
          name,
        }),
      });
      const workspaceId = response.data?._id;
      router.push(workspaceId ? `/workspace/${workspaceId}` : '/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <h1 className="text-3xl font-bold">Create Workspace</h1>

      <input
        className="border p-3 w-full"
        placeholder="Workspace name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button className="bg-black text-white p-3 rounded w-full">
        {loading ? 'Creating...' : 'Create Workspace'}
      </button>
    </form>
  );
}