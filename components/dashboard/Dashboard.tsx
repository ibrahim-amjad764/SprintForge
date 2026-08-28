// components/dashboard/Dashboard.tsx
"use client";

import { useState, useEffect } from 'react';
import { MetricCards } from './MetricCards';
import { ActivityStream } from './ActivityStream';
import { QuickActionSidebar } from './QuickActionSidebar';
import { EmptyState } from './EmptyState';
import TaskChart from './TaskChart';
import TaskFeed from './TaskFeed';
import { useLocalStorageSubscription } from '@/hooks/useLocalStorageSubscription';

export default function Dashboard({ stats, workspaceId }: { stats: any; workspaceId?: string }) {
  const [showEmptyState, setShowEmptyState] = useState<'projects' | 'tasks' | 'members' | null>(null);
  const [localStats, setLocalStats] = useState(stats);

  // Subscribe to calendarTasks changes for real-time metrics updates
  const calendarTasks = useLocalStorageSubscription({ key: 'calendarTasks' });

  // Recalculate task count when tasks change
  useEffect(() => {
    if (calendarTasks && workspaceId) {
      const taskCount = calendarTasks.filter((task: any) => {
        // Filter by workspace context
        const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
        const currentProjectId = pathParts[4] || undefined;
        
        if (currentProjectId) {
          return String(task.projectId) === String(currentProjectId);
        }
        return true; // All tasks in workspace
      }).length;

      setLocalStats(prev => ({
        ...prev,
        total: taskCount
      }));
    }
  }, [calendarTasks, workspaceId]);

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
        projectsCount={localStats?.projects || stats?.projects || 0}
        tasksCount={localStats?.total || stats?.total || 0}
        membersCount={localStats?.members || stats?.members || 1}
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
