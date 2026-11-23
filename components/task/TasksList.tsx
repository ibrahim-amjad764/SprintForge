'use client';

import { useState, useEffect } from 'react';
import { Task } from '../calendar/Calendar';
import { Calendar, User, MoreVertical, Trash2, Edit2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface TasksListProps {
  tasks: Task[];
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

export default function TasksList({
  tasks,
  onTaskUpdated,
  onTaskDeleted,
}: TasksListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editStatus, setEditStatus] = useState('TODO');
  const [editAssignedToId, setEditAssignedToId] = useState<string | undefined>(
    undefined
  );
  const [editDueDate, setEditDueDate] = useState('');
  const [editTeamId, setEditTeamId] = useState<string | undefined>(undefined);
  const [availableMembers, setAvailableMembers] = useState<
    { id: string; name: string; teamId: string }[]
  >([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  // Load workspace members and teams on mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const workspaceId = window.location.pathname.split('/')[2];
        console.log('TasksList: Loading members for workspaceId:', workspaceId);
        const storedTeams = localStorage.getItem(`teams_${workspaceId}`);
        console.log('TasksList: Stored teams data:', storedTeams);
        if (storedTeams) {
          const teams = JSON.parse(storedTeams);
          // Store full teams list for Team dropdown
          setTeamsList(teams);
          console.log('TasksList: Loaded teams list:', teams);

          // Extract members for Assignee dropdown
          const members: { id: string; name: string; teamId: string }[] = [];
          teams.forEach((team: any) => {
            team.members.forEach((member: any) => {
              members.push({ id: member.id, name: member.name, teamId: team.id });
            });
          });
          console.log('TasksList: Loaded members:', members);
          setAvailableMembers(members);
        } else {
          console.log('TasksList: No teams found in LocalStorage');
        }
      } catch (error) {
        console.error('Error loading members:', error);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  // Get team name from teamId
  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'Unassigned';
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
        return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300';
      case 'MEDIUM':
        return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
      case 'LOW':
        return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      case 'URGENT':
        return 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300';
      default:
        return 'border-border bg-muted text-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'border-border bg-muted text-foreground';
      case 'IN_PROGRESS':
        return 'border-primary/25 bg-primary/10 text-primary';
      case 'REVIEW':
        return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
      case 'DONE':
      case 'COMPLETED':
        return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      default:
        return 'border-border bg-muted text-foreground';
    }
  };

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return '-';
    const date = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.floor(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays <= 7) return `In ${diffDays}d`;
    return date.toLocaleDateString();
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    const updatedTask = {
      ...task,
      status: newStatus,
      completedAt:
        newStatus === 'DONE' || newStatus === 'COMPLETED'
          ? new Date().toISOString()
          : undefined,
    };
    onTaskUpdated(updatedTask);
    toast.success('Task status updated');
  };

  const handleDelete = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onTaskDeleted(taskId);
      toast.success('Task deleted');
    }
  };

  const handleEditStart = (task: Task) => {
    setEditingTaskId(task._id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditStatus(task.status || 'TODO');
    setEditAssignedToId(task.assignedToId);
    // task.teamId may be a string or an object; normalize to string | undefined
    if (typeof task.teamId === 'string') {
      setEditTeamId(task.teamId);
    } else if (task.teamId && typeof task.teamId === 'object') {
      // support {_id, id} shapes
      // prefer _id then id
      setEditTeamId(task.teamId._id || task.teamId.id || undefined);
    } else {
      setEditTeamId(undefined);
    }
    setEditDueDate(task.dueDate || '');
  };

  const handleEditSave = (task: Task) => {
    // Auto-extract projectId from URL
    const pathParts = window.location.pathname.split('/');
    const currentProjectId = pathParts[4] || undefined;

    const updatedTask = {
      ...task,
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      status: editStatus,
      assignedToId: editAssignedToId,
      teamId: editTeamId,
      dueDate: editDueDate || undefined,
      projectId: currentProjectId,
    };
    onTaskUpdated(updatedTask);
    setEditingTaskId(null);
    toast.success('Task updated');
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
    setEditPriority('MEDIUM');
    setEditStatus('TODO');
    setEditAssignedToId(undefined);
    setEditTeamId(undefined);
    setEditDueDate('');
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* <Link
                              href={`/workspace/${workspaceId}/projects/${projectId}`}
                              className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 mb-2 inline-block"
                            >
                              ← Back to Project
                            </Link> */}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead className="border-b border-border bg-muted/60">
          <tr>
            <th className="px-6 py-3.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Task Title
            </th>
            <th className="px-6 py-3.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Priority
            </th>
            <th className="px-6 py-3.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Status
            </th>
            <th className="px-6 py-3.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Assignee
            </th>
            <th className="px-6 py-3.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Team
            </th>
            <th className="px-6 py-3.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Due Date
            </th>
            <th className="px-6 py-3.5 text-right font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-foreground">No tasks found</p>
                <p className="mt-1 text-xs text-muted-foreground">Tasks assigned to this project will appear here.</p>
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr key={task._id} className="transition-colors hover:bg-muted/40">
                <td className="px-6 py-4">
                  {editingTaskId === task._id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded border border-border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <>
                      <div className="font-medium text-foreground">
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {task.description}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingTaskId === task._id ? (
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="rounded border border-border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityColor(task.priority)}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {task.priority}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingTaskId === task._id ? (
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="rounded border border-border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(task.status)}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {task.status === 'IN_PROGRESS' ? 'In Progress' : 
                       task.status === 'DONE' ? 'Done' : 
                       task.status === 'COMPLETED' ? 'Completed' :
                       task.status === 'REVIEW' ? 'In Review' :
                       task.status}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingTaskId === task._id ? (
                    <select
                      value={editAssignedToId || ''}
                      onChange={(e) =>
                        setEditAssignedToId(e.target.value || undefined)
                      }
                      className="rounded border border-border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {availableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  ) : task.assignedToId ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-medium text-white">
                        {getMemberName(task.assignedToId)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <span className="text-sm text-foreground">
                        {getMemberName(task.assignedToId)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingTaskId === task._id ? (
                    <select
                      value={editTeamId || ''}
                      onChange={(e) => setEditTeamId(e.target.value || undefined)}
                      className="rounded border border-border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {teamsList.map((teamItem: any) => (
                        <option key={teamItem.id} value={teamItem.id}>
                          {teamItem.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {getTeamName(typeof task.teamId === 'string' ? task.teamId : task.teamId?.id || task.teamId?._id)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingTaskId === task._id ? (
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="rounded border border-border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <div className="font-mono text-xs text-muted-foreground tabular-nums">
                      {task.dueDate
                        ? formatDueDate(task.dueDate)
                        : 'No due date'}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {editingTaskId === task._id ? (
                      <>
                        <button
                          onClick={() => handleEditSave(task)}
                          className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                          title="Save"
                          aria-label="Save task"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
                          title="Cancel"
                          aria-label="Cancel edit"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditStart(task)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          title="Edit"
                          aria-label="Edit task"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task._id)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                          aria-label="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
