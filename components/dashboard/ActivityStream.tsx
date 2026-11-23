// components/dashboard/ActivityStream.tsx
"use client";

import { CheckCircle, Plug, Package, Clock, User } from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'workspace_created' | 'integration_connected' | 'repo_provisioned' | 'task_completed' | 'member_joined';
  message: string;
  user?: string;
  timestamp: Date;
}

interface ActivityStreamProps {
  activities?: ActivityItem[];
}

const activityIcons = {
  workspace_created: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  integration_connected: { icon: Plug, color: 'text-primary bg-primary/10 border-primary/25' },
  repo_provisioned: { icon: Package, color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25' },
  task_completed: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  member_joined: { icon: User, color: 'text-primary bg-primary/10 border-primary/25' },
};

const defaultActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'workspace_created',
    message: 'Workspace "Project Alpha" created',
    user: 'Sadie Sink',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: '2',
    type: 'integration_connected',
    message: 'Slack integration connected successfully',
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: '3',
    type: 'repo_provisioned',
    message: 'GitHub auto-provisioning repository initialized',
    timestamp: new Date(Date.now() - 1 * 60 * 1000),
  },
];

export function ActivityStream({ activities = defaultActivities }: ActivityStreamProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" style={{ '--i': 3 } as React.CSSProperties}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold tracking-tight text-foreground">Recent Activity</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">LIVE FEED</p>
        </div>
        <button className="rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10">
          View all
        </button>
      </div>

      <div className="space-y-1">
        {activities.map((activity, i) => {
          const { icon: Icon, color } = activityIcons[activity.type];

          return (
            <div
              key={activity.id}
              className="animate-enter flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
              style={{ '--i': 4 + i } as React.CSSProperties}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${color}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{activity.message}</p>
                <div className="mt-1 flex items-center gap-2">
                  {activity.user && (
                    <>
                      <span className="text-xs text-muted-foreground">by {activity.user}</span>
                      <span className="text-xs text-border" aria-hidden="true">•</span>
                    </>
                  )}
                  <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
