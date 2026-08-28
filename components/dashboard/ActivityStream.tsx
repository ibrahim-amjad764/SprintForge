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
  workspace_created: { icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  integration_connected: { icon: Plug, color: 'text-blue-600 bg-blue-50' },
  repo_provisioned: { icon: Package, color: 'text-purple-600 bg-purple-50' },
  task_completed: { icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  member_joined: { icon: User, color: 'text-blue-600 bg-blue-50' },
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
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        <button className="text-sm text-blue-600 hover:text-blue-800">View All</button>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity) => {
          const { icon: Icon, color } = activityIcons[activity.type];
          
          return (
            <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  {activity.user && (
                    <>
                      <span className="text-xs text-gray-500">by {activity.user}</span>
                      <span className="text-xs text-gray-300">•</span>
                    </>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
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
