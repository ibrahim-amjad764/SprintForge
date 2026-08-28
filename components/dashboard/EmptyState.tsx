// components/dashboard/EmptyState.tsx
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
    defaultTitle: 'No projects found',
    defaultDescription: 'Get started by creating your first project to organize your work.',
    defaultActionLabel: 'Create Project',
  },
  tasks: {
    icon: CheckSquare,
    defaultTitle: 'No tasks found',
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
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-gray-400" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title || config.defaultTitle}
      </h3>
      
      <p className="text-gray-500 text-center max-w-md mb-6">
        {description || config.defaultDescription}
      </p>
      
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          {actionLabel || config.defaultActionLabel}
        </button>
      )}
    </div>
  );
}
