'use client';

import { X } from 'lucide-react';
import { Task } from '../calendar/Calendar';

interface ActiveTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export default function ActiveTasksModal({ isOpen, onClose, tasks }: ActiveTasksModalProps) {
  if (!isOpen) return null;

  // Filter tasks that are not done
  const activeTasks = tasks.filter((task) => task.status !== 'DONE' && task.status !== 'COMPLETED');

  // Calculate priority distribution
  const highPriorityCount = activeTasks.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT').length;
  const mediumPriorityCount = activeTasks.filter((t) => t.priority === 'MEDIUM').length;
  const lowPriorityCount = activeTasks.filter((t) => t.priority === 'LOW').length;
  const total = activeTasks.length;

  // Get team name from teamId
  const getTeamName = (teamId?: string | { _id?: string; id?: string; name?: string }) => {
    if (!teamId) return 'Unassigned';
    if (typeof teamId === 'string') {
      try {
        const workspaceId = window.location.pathname.split('/')[2];
        const storedTeams = localStorage.getItem(`teams_${workspaceId}`);
        if (storedTeams) {
          const teams = JSON.parse(storedTeams);
          const team = teams.find((t: any) => t.id === teamId);
          return team?.name || 'Unknown Team';
        }
      } catch (error) {
        console.error('Error getting team name:', error);
      }
      return 'Unknown Team';
    }
    return teamId.name || 'Unknown Team';
  };

  // Get member name from assignedToId
  const getMemberName = (assignedToId?: string) => {
    if (!assignedToId) return 'Unassigned';
    try {
      const workspaceId = window.location.pathname.split('/')[2];
      const storedTeams = localStorage.getItem(`teams_${workspaceId}`);
      if (storedTeams) {
        const teams = JSON.parse(storedTeams);
        for (const team of teams) {
          const member = team.members.find((m: any) => m.id === assignedToId);
          if (member) return member.name;
        }
      }
    } catch (error) {
      console.error('Error getting member name:', error);
    }
    return 'Unknown';
  };

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return '';
    const date = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays <= 7) return `In ${diffDays} days`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Active Tasks Backlog ({activeTasks.length})</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Priority Distribution Bar */}
          {total > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Priority Distribution</h3>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
                {highPriorityCount > 0 && (
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${(highPriorityCount / total) * 100}%` }}
                    title={`High: ${highPriorityCount}`}
                  />
                )}
                {mediumPriorityCount > 0 && (
                  <div
                    className="bg-yellow-500 transition-all"
                    style={{ width: `${(mediumPriorityCount / total) * 100}%` }}
                    title={`Medium: ${mediumPriorityCount}`}
                  />
                )}
                {lowPriorityCount > 0 && (
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(lowPriorityCount / total) * 100}%` }}
                    title={`Low: ${lowPriorityCount}`}
                  />
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  High: {highPriorityCount}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  Medium: {mediumPriorityCount}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Low: {lowPriorityCount}
                </span>
              </div>
            </div>
          )}

          {/* Task List */}
          {activeTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No active tasks found
            </div>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <div
                  key={task._id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 flex-1">{task.title}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        task.priority === 'HIGH' || task.priority === 'URGENT'
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    {/* Team Badge */}
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                      {getTeamName(task.teamId)}
                    </span>

                    {/* Assignee Avatar */}
                    {task.assignedToId && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {getMemberName(task.assignedToId).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-600">{getMemberName(task.assignedToId)}</span>
                      </div>
                    )}

                    {/* Due Date */}
                    {task.dueDate && (
                      <span className="text-gray-500">{formatDueDate(task.dueDate)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
