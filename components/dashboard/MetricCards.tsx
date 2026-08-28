// components/dashboard/MetricCards.tsx
"use client";

import { FolderKanban, CheckSquare, Users, Plus } from "lucide-react";

interface MetricCardProps {
  title: string;
  count: number;
  icon: React.ElementType;
  color: string;
  actionLabel?: string;
  onAction?: () => void;
}

function MetricCard({ title, count, icon: Icon, color, actionLabel, onAction }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="flex items-start justify-between flex-1">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
          </div>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={actionLabel}
          >
            <Plus className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
      <MetricCard
        title="Active Projects"
        count={projectsCount}
        icon={FolderKanban}
        color="blue"
        actionLabel="Create Project"
        onAction={onCreateProject}
      />
      <MetricCard
        title="Pending Tasks"
        count={tasksCount}
        icon={CheckSquare}
        color="green"
        actionLabel="Assign Task"
        onAction={onCreateTask}
      />
      <MetricCard
        title="Team Members"
        count={membersCount}
        icon={Users}
        color="purple"
        actionLabel="Invite Member"
        onAction={onInviteMember}
      />
    </div>
  );
}
