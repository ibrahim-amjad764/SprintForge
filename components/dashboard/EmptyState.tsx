"use client";

import { FolderKanban, CheckSquare, Users, Plus } from "lucide-react";

interface EmptyStateProps {
  type: 'projects' | 'tasks' | 'members';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const emptyStateConfig = {
  projects: {
    icon: FolderKanban,
    defaultTitle: 'No projects yet',
    defaultDescription: 'Get started by creating your first project to organize your work.',
    defaultActionLabel: 'Create Project',
  },
  tasks: {
    icon: CheckSquare,
    defaultTitle: 'No tasks yet',
    defaultDescription: 'Create tasks to track progress and collaborate with your team.',
    defaultActionLabel: 'Create Task',
  },
  members: {
    icon: Users,
    defaultTitle: 'No team members yet',
    defaultDescription: 'Invite team members to collaborate on projects and tasks.',
    defaultActionLabel: 'Invite Member',
  },
};

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  return (
    <div className="animate-scale-in flex flex-col items-center justify-center px-4 py-16">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl" aria-hidden="true" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <Icon className="h-9 w-9 text-primary" aria-hidden="true" />
        </div>
      </div>

      <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
        {title || config.defaultTitle}
      </h3>

      <p className="mb-6 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
        {description || config.defaultDescription}
      </p>

      {onAction && (
        <button
          onClick={onAction}
          className="btn-sheen flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {actionLabel || config.defaultActionLabel}
        </button>
      )}
    </div>
  );
}
