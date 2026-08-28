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
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
      onClick: onCreateProject || (() => {}),
    },
    {
      id: 'assign-task',
      label: 'Assign New Task',
      icon: PlusSquare,
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
      onClick: onAssignTask || (() => {}),
    },
    {
      id: 'invite-member',
      label: 'Invite Team Members',
      icon: UserPlus,
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
      onClick: onInviteMember || (() => {}),
    },
    {
      id: 'notifications',
      label: 'Notification Settings',
      icon: Bell,
      color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
      onClick: onNotifications || (() => {}),
    },
    {
      id: 'integrations',
      label: 'Manage Integrations',
      icon: Zap,
      color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
      onClick: onIntegrations || (() => {}),
    },
    {
      id: 'settings',
      label: 'Workspace Settings',
      icon: Settings,
      color: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
      onClick: onSettings || (() => {}),
    },
  ];

  return (
    <div className="sticky top-6">
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors ${action.color}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium text-left">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
