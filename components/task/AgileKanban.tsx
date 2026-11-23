'use client';

import { useState } from 'react';
import { Task } from '../calendar/Calendar';
import { Calendar, User, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FilterState } from '../filters/GlobalFilter';

interface AgileKanbanProps {
  tasks: Task[];
  onTaskUpdated: (task: Task) => void;
  filters?: FilterState;
}

type ColumnType = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

interface Column {
  id: ColumnType;
  title: string;
  icon: string;
  color: string;
}

const columns: Column[] = [
  { id: 'TODO', title: 'To Do', icon: '📝', color: 'bg-muted' },
  { id: 'IN_PROGRESS', title: 'In Progress', icon: '⏳', color: 'bg-blue-100 dark:bg-blue-500/15' },
  { id: 'REVIEW', title: 'In Review', icon: '🔍', color: 'bg-yellow-100 dark:bg-yellow-500/15' },
  { id: 'DONE', title: 'Done', icon: '✅', color: 'bg-green-100 dark:bg-green-500/15' },
];

export default function AgileKanban({ tasks, onTaskUpdated, filters }: AgileKanbanProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Apply filters to tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        task.title?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Priority filter
    if (filters?.priority && filters.priority.length > 0) {
      if (!filters.priority.includes(task.priority)) return false;
    }

    // Status filter
    if (filters?.status && filters.status.length > 0) {
      if (!filters.status.includes(task.status)) return false;
    }

    // Assignee filter
    if (filters?.assigneeId && filters.assigneeId.length > 0) {
      if (!filters.assigneeId.includes(task.assignedToId || '')) return false;
    }

    return true;
  });

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-green-500';
      case 'URGENT':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTasksByColumn = (column: ColumnType) => {
    return filteredTasks.filter((task) => task.status === column);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
      e.currentTarget.style.transform = 'rotate(2deg)';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
      e.currentTarget.style.transform = 'rotate(0deg)';
    }
    setDraggedTask(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, column: ColumnType) => {
    e.preventDefault();
    if (!draggedTask) return;

    if (draggedTask.status !== column) {
      const updatedTask = {
        ...draggedTask,
        status: column,
        completedAt: column === 'DONE' ? new Date().toISOString() : undefined,
      };

      onTaskUpdated(updatedTask);
      toast.success(`Task moved to ${columns.find((c) => c.id === column)?.title}`);
    }
  };

  const handleDelete = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      const updatedTasks = tasks.filter((t) => t._id !== taskId);
      localStorage.setItem('calendarTasks', JSON.stringify(updatedTasks));
      toast.success('Task deleted');
      // Force re-render by triggering parent update
      onTaskUpdated({ _id: taskId, title: '', status: 'TODO', priority: 'MEDIUM' } as Task);
    }
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
    <div className="h-full bg-muted p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
        {columns.map((column) => {
          const columnTasks = getTasksByColumn(column.id);
          
          return (
            <div
              key={column.id}
              className={`${column.color} rounded-xl p-4 flex flex-col h-full`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{column.icon}</span>
                  <h3 className="font-semibold text-foreground">{column.title}</h3>
                </div>
                <span className="px-3 py-1 bg-card rounded-full text-sm font-medium text-muted-foreground shadow-sm">
                  {columnTasks.length}
                </span>
              </div>

              {/* Task Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {columnTasks.map((task) => (
                  <div
                    key={task._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className="bg-card rounded-lg border shadow-sm p-4 hover:shadow-md transition-all cursor-move"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-foreground text-sm flex-1">{task.title}</h4>
                      <div className="flex items-center gap-2 ml-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`}
                          title={task.priority}
                        />
                        <button
                          onClick={() => handleDelete(task._id)}
                          className="p-1 hover:bg-red-50 dark:bg-red-500/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600 dark:text-red-300" />
                        </button>
                      </div>
                    </div>

                    {/* Team Badge */}
                    <div className="mb-3">
                      <span className="inline-block px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs rounded-md font-medium">
                        {getTeamName(task.teamId)}
                      </span>
                    </div>

                    {/* Description */}
                    {task.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      {/* Due Date */}
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDueDate(task.dueDate)}</span>
                        </div>
                      )}

                      {/* Assignee Avatar */}
                      {task.assignedToId && (
                        <div
                          className="w-7 h-7 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          title={getMemberName(task.assignedToId)}
                        >
                          {getMemberName(task.assignedToId).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
