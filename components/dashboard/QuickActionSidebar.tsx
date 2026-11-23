// components/dashboard/QuickActionSidebar.tsx
"use client";

import { FolderPlus, PlusSquare, UserPlus, Settings, Bell, Zap } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
}

interface QuickActionSidebarProps {
  onCreateProject?: () => void;
  onAssignTask?: () => void;
  onInviteMember?: () => void;
  onSettings?: () => void;
  onNotifications?: () => void;
  onIntegrations?: () => void;
}

export function QuickActionSidebar({
  onCreateProject,
  onAssignTask,
  onInviteMember,
  onSettings,
  onNotifications,
  onIntegrations,
}: QuickActionSidebarProps) {
  const quickActions: QuickAction[] = [
    {
      id: 'create-project',
      label: 'Create New Project',
      icon: FolderPlus,
      color: 'text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20',
      onClick: onCreateProject || (() => {}),
    },
    {
      id: 'assign-task',
      label: 'Assign New Task',
      icon: PlusSquare,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20',
      onClick: onAssignTask || (() => {}),
    },
    {
      id: 'invite-member',
      label: 'Invite Team Members',
      icon: UserPlus,
      color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20',
      onClick: onInviteMember || (() => {}),
    },
    {
      id: 'notifications',
      label: 'Notification Settings',
      icon: Bell,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20',
      onClick: onNotifications || (() => {}),
    },
    {
      id: 'integrations',
      label: 'Manage Integrations',
      icon: Zap,
      color: 'text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20',
      onClick: onIntegrations || (() => {}),
    },
    {
      id: 'settings',
      label: 'Workspace Settings',
      icon: Settings,
      color: 'text-muted-foreground bg-muted hover:bg-muted border border-border',
      onClick: onSettings || (() => {}),
    },
  ];

  return (
    <div className="sticky top-6">
      <div className="animate-enter rounded-2xl border border-border bg-card p-4 shadow-card" style={{ '--i': 4 } as React.CSSProperties}>
        <h3 className="mb-1 font-semibold tracking-tight text-foreground">Quick Actions</h3>
        <p className="mb-4 font-mono text-[11px] text-muted-foreground">SHORTCUTS</p>
        <div className="space-y-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-150 hover:-translate-y-px hover:shadow-card ${action.color}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
