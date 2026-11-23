"use client";

import { FolderKanban, CheckSquare, Users, Plus } from "lucide-react";

interface MetricCardProps {
  title: string;
  count: number;
  icon: React.ElementType;
  accent: 'primary' | 'success' | 'accent';
  actionLabel?: string;
  onAction?: () => void;
  index?: number;
}

const accentStyles = {
  primary: 'border-primary/20 bg-primary/10 text-primary',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  accent: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

function MetricCard({ title, count, icon: Icon, accent, actionLabel, onAction, index = 0 }: MetricCardProps) {
  return (
    <div
      className="animate-enter flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-popover"
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accentStyles[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            aria-label={actionLabel}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight tabular-nums">
        {count}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

interface MetricCardsProps {
  projectsCount?: number;
  tasksCount?: number;
  membersCount?: number;
  onCreateProject?: () => void;
  onCreateTask?: () => void;
  onInviteMember?: () => void;
}

export function MetricCards({
  projectsCount = 0,
  tasksCount = 0,
  membersCount = 1,
  onCreateProject,
  onCreateTask,
  onInviteMember,
}: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
      <MetricCard
        title="Active Projects"
        count={projectsCount}
        icon={FolderKanban}
        accent="primary"
        actionLabel="Create Project"
        onAction={onCreateProject}
        index={0}
      />
      <MetricCard
        title="Pending Tasks"
        count={tasksCount}
        icon={CheckSquare}
        accent="success"
        actionLabel="Assign Task"
        onAction={onCreateTask}
        index={1}
      />
      <MetricCard
        title="Team Members"
        count={membersCount}
        icon={Users}
        accent="accent"
        actionLabel="Invite Member"
        onAction={onInviteMember}
        index={2}
      />
    </div>
  );
}
