// components / task / TaskEditForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { ChevronLeft } from 'lucide-react';

interface TaskLike {
  _id: string | { toString(): string };
  title: string;
  description?: string;
}
interface Props { task: TaskLike }

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
    <div className="mx-auto max-w-xl">
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to tasks
      </Link>

      <form
        onSubmit={submit}
        className="animate-enter space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"
      >
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Tasks
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Edit Task</h1>
        </div>

        <div>
          <label htmlFor="task-title" className="mb-1.5 block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="task-title"
            className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="task-description" className="mb-1.5 block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="task-description"
            className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button className="btn-sheen rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98]">
            Save Changes
          </button>
          <Link
            href="/tasks"
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
