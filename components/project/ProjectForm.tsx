'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

interface Props {
  workspaceId: string;
}

export default function ProjectForm({ workspaceId }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      await apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          workspace: workspaceId,
        }),
      });

      setName('');
      setDescription('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <input
        className="w-full rounded-md border p-3"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <textarea
        className="w-full rounded-md border p-3"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary p-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
}
