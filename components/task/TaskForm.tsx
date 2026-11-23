'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskCreated?: (task: any) => void;
}

const MAX_TITLE_LENGTH = 50;

export default function TaskForm({ projectId, onTaskCreated }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setDueDate(date.toISOString().split('T')[0]);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!title.trim()) {
      setError('Task title is required');
      toast.error('Task title is required');
      return;
    }

    if (title.length > MAX_TITLE_LENGTH) {
      setError(`Task title must be ${MAX_TITLE_LENGTH} characters or less`);
      toast.error(`Task title must be ${MAX_TITLE_LENGTH} characters or less`);
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          priority,
          project: projectId,
          dueDate: dueDate || undefined,
        }),
      });

      // Form success feedback
      setTitle('');
      setPriority('MEDIUM');
      setDueDate('');
      
      toast.success('Task created successfully');
      
      // Notify parent component to prepend task
      if (onTaskCreated && response.data) {
        onTaskCreated(response.data);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Keyboard submission handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form onSubmit={submit} className="mb-8 max-w-md space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="space-y-2">
        <input
          type="text"
          className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_TITLE_LENGTH}
          required
          disabled={loading}
        />
        {/* Dynamic character counter */}
        <div className="text-xs text-muted-foreground text-right">
          {title.length} / {MAX_TITLE_LENGTH} characters
        </div>
      </div>

      <select
        className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        disabled={loading}
      >
        <option value="LOW">LOW</option>
        <option value="MEDIUM">MEDIUM</option>
        <option value="HIGH">HIGH</option>
        <option value="URGENT">URGENT</option>
      </select>

      <div className="space-y-2">
        <input
          type="date"
          className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={loading}
        />
        {/* Due date quick-presets */}
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setQuickDate(0)}
            className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 hover:underline"
            disabled={loading}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setQuickDate(1)}
            className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 hover:underline"
            disabled={loading}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setQuickDate(7)}
            className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 hover:underline"
            disabled={loading}
          >
            Next Week
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create Task'}
      </button>
    </form>
  );
}
