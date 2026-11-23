// app/tasks/new/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { ListChecks, ArrowLeft } from 'lucide-react';

export default function NewTaskPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-xl py-10">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Tasks
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Create New Task</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Task creation is done inline from the board or list views.
        </p>

        <div className="animate-enter mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold tracking-tight">No standalone form here</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Open a project board and use the inline &ldquo;Add Task&rdquo; flow, or pick a
            project from your workspace to get started.
          </p>
          <Link
            href="/dashboard"
            className="btn-sheen mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
