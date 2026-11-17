// components/dashboard/Dashboard.tsx
"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MetricCards } from './MetricCards';
import { ActivityStream } from './ActivityStream';
import { QuickActionSidebar } from './QuickActionSidebar';
import { EmptyState } from './EmptyState';
import { useLocalStorageSubscription } from '@/hooks/useLocalStorageSubscription';

export default function Dashboard({ stats, workspaceId }: { stats: any; workspaceId?: string }) {
  const [showEmptyState, setShowEmptyState] = useState<'projects' | 'tasks' | 'members' | null>(null);
  const pathname = usePathname();

  // Subscribe to calendarTasks changes for real-time metrics updates
  const calendarTasks = useLocalStorageSubscription({ key: 'calendarTasks' });

  // Recalculate task count when tasks change
  const taskCount =
    calendarTasks && workspaceId
      ? calendarTasks.filter((task: any) => {
          // Filter by workspace context
          const pathParts = pathname?.split('/') || [];
          const currentProjectId = pathParts[4] || undefined;

          if (currentProjectId) {
            return String(task.projectId) === String(currentProjectId);
          }
          return true; // All tasks in workspace
        }).length
      : undefined;

  const displayStats =
    taskCount !== undefined ? { ...stats, total: taskCount } : stats;

  const handleCreateProject = () => {
    setShowEmptyState('projects');
  };

  const handleAssignTask = () => {
    setShowEmptyState('tasks');
  };

  const handleInviteMember = () => {
    setShowEmptyState('members');
  };

  // If showing empty state, render that instead
  if (showEmptyState) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowEmptyState(null)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </button>
        <EmptyState
          type={showEmptyState}
          onAction={() => setShowEmptyState(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <MetricCards
        projectsCount={displayStats?.projects || stats?.projects || 0}
        tasksCount={displayStats?.total || stats?.total || 0}
        membersCount={displayStats?.members || stats?.members || 1}
        onCreateProject={handleCreateProject}
        onCreateTask={handleAssignTask}
        onInviteMember={handleInviteMember}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Stream */}
          <ActivityStream />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <QuickActionSidebar
            onCreateProject={handleCreateProject}
            onAssignTask={handleAssignTask}
            onInviteMember={handleInviteMember}
          />
        </div>
      </div>
    </div>
  );
}
