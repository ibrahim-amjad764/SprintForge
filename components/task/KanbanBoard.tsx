// components/task/KanbanBoard.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  RotateCcw,
  Plus,
  X,
  Calendar,
  MoreVertical,
  Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignee?: string;
  assigneeName?: string;
  projectId?: string;
  projectName?: string;
  createdAt?: string;
  dueDate?: string;
}

interface Project {
  _id: string;
  name: string;
}

interface TeamMember {
  _id: string;
  name: string;
  email: string;
}

interface Props {
  workspaceId: string;
  tasks: Task[];
  projects?: Project[];
  teamMembers?: TeamMember[];
}

type ColumnType = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
type PriorityFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW';

export default function KanbanBoard({
  workspaceId,
  tasks: initialTasks,
  projects = [],
  teamMembers = [],
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [inlineTaskColumn, setInlineTaskColumn] = useState<ColumnType | null>(
    null
  );
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [taskMenuOpen, setTaskMenuOpen] = useState<string | null>(null);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const pathname = usePathname();
  const urlProjectId = pathname?.split('/')[4] || '';
  const [projectIdOverride, setProjectId] = useState<string | undefined>(
    undefined
  );
  const projectId = projectIdOverride ?? urlProjectId;
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Update browser tab title
  useEffect(() => {
    document.title = 'SprintForge | Kanban Board';
  }, []);

  // Load tasks from API on mount
  useEffect(() => {
    async function loadTasks() {
      try {
        if (projectId) {
          const response = await fetch(`/api/tasks?project=${projectId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Transform DB tasks to match Task interface
              const transformedTasks = data.data.map((dbTask: any) => ({
                _id: dbTask._id,
                title: dbTask.title,
                description: dbTask.description,
                status: dbTask.status,
                priority: dbTask.priority,
                assignee: dbTask.assignee?._id || dbTask.assignee,
                assigneeName: dbTask.assignee?.name,
                projectId: dbTask.project,
                dueDate: dbTask.dueDate,
                createdAt: dbTask.createdAt,
              }));
              setTasks(transformedTasks);
            }
          }
        }
      } catch (error) {
        console.error('Error loading tasks from API:', error);
      }
    }

    loadTasks();
  }, [projectId]);

  // Calculate column counts
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter(
    (t) => t.status === 'IN_PROGRESS'
  ).length;
  const doneCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  // Calculate progress percentage
  const progressPercentage =
    tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Filter tasks based on search and priority
  const filteredTasks = tasks.filter((task) => {
    const searchMatch =
      searchQuery === '' ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description &&
        task.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const priorityMatch =
      priorityFilter === 'all' || task.priority === priorityFilter;

    return searchMatch && priorityMatch;
  });

  // Get tasks for each column
  const getTasksByColumn = (column: ColumnType) => {
    return filteredTasks.filter((task) => task.status === column);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      toast.loading('Creating task...', { id: 'create-task' });

      const response = await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          priority,
          status: 'TODO',
          project: projectId || undefined,
          assignee: assigneeId || undefined,
        }),
      });

      if (response.success) {
        // Auto-extract projectId from URL if not provided
        const pathParts = window.location.pathname.split('/');
        const currentProjectId = projectId || pathParts[4] || undefined;

        const newTask: Task = {
          _id: response.data._id,
          title,
          description,
          status: 'TODO',
          priority,
          assignee: assigneeId,
          assigneeName: teamMembers.find((m) => m._id === assigneeId)?.name,
          projectId: currentProjectId,
          projectName: projects.find((p) => p._id === currentProjectId)?.name,
          createdAt: new Date().toISOString(),
          dueDate: dueDate || undefined,
        };

        setTasks([...tasks, newTask]);

        // Save to API
        try {
          const dbTask = {
            title,
            description,
            project: currentProjectId,
            priority,
            assignee: assigneeId,
            status: 'TODO',
            dueDate: dueDate || undefined,
          };

          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dbTask),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Transform back to Task interface
              const transformedTask = {
                _id: data.data._id,
                title: data.data.title,
                description: data.data.description,
                status: data.data.status,
                priority: data.data.priority,
                assignee: data.data.assignee?._id || data.data.assignee,
                assigneeName: data.data.assignee?.name,
                projectId: data.data.project,
                dueDate: data.data.dueDate,
                createdAt: data.data.createdAt,
              };
              setTasks((prev) => prev.map((t) => (t._id === newTask._id ? transformedTask : t)));
            }
          }
        } catch (error) {
          console.error('Error creating task:', error);
        }

        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setProjectId('');
        setAssigneeId('');
        setDueDate('');
        router.refresh();
        toast.success('Task created successfully!', { id: 'create-task' });
      } else {
        setError(response.message || 'Failed to create task');
        toast.error(response.message || 'Failed to create task', {
          id: 'create-task',
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      toast.error(
        err instanceof Error ? err.message : 'Failed to create task',
        { id: 'create-task' }
      );
    } finally {
      setLoading(false);
    }
  }

  const moveTask = (taskId: string, direction: 'left' | 'right') => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;

    const statusOrder: ColumnType[] = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(task.status);

    let newIndex = currentIndex;
    if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < statusOrder.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      return;
    }

    const newStatus = statusOrder[newIndex];
    setTasks(
      tasks.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    apiRequest(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    }).catch((err) => console.error('Failed to move task:', err));
  };

  const deleteTask = (taskId: string) => {
    toast.loading('Deleting task...', { id: 'delete-task' });
    setTasks(tasks.filter((t) => t._id !== taskId));

    apiRequest(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    })
      .then(() => {
        toast.success('Task deleted successfully!', { id: 'delete-task' });
      })
      .catch((err) => {
        console.error('Failed to delete task:', err);
        toast.error('Failed to delete task', { id: 'delete-task' });
      });
  };

  const clearBoard = () => {
    if (
      window.confirm(
        'Are you sure you want to delete all tasks? This action cannot be undone.'
      )
    ) {
      setTasks([]);
    }
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

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return date.toLocaleDateString();
  };

  const handleCreateTaskFocus = () => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  };

  const handleInlineTaskSubmit = async (column: ColumnType) => {
    if (!inlineTaskTitle.trim()) return;

    // Auto-extract projectId from URL
    const pathParts = window.location.pathname.split('/');
    const currentProjectId = pathParts[4] || undefined;

    const newTask: Task = {
      _id: `temp-${Date.now()}`,
      title: inlineTaskTitle,
      status: column,
      priority: 'MEDIUM',
      projectId: currentProjectId,
      createdAt: new Date().toISOString(),
    };

    setTasks([...tasks, newTask]);

    // Save to API
    try {
      const dbTask = {
        title: inlineTaskTitle,
        project: currentProjectId,
        status: column,
        priority: 'MEDIUM',
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbTask),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Transform back to Task interface
          const transformedTask = {
            _id: data.data._id,
            title: data.data.title,
            description: data.data.description,
            status: data.data.status,
            priority: data.data.priority,
            assignee: data.data.assignee?._id || data.data.assignee,
            assigneeName: data.data.assignee?.name,
            projectId: data.data.project,
            dueDate: data.data.dueDate,
            createdAt: data.data.createdAt,
          };
          setTasks((prev) => prev.map((t) => (t._id === newTask._id ? transformedTask : t)));
        }
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }

    setInlineTaskTitle('');
    setInlineTaskColumn(null);
    toast.success('Task created successfully!', { id: 'inline-task' });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, column: ColumnType) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find((t) => t._id === taskId);

    if (task && task.status !== column) {
      toast.loading('Moving task...', { id: 'move-task' });
      setTasks(
        tasks.map((t) => (t._id === taskId ? { ...t, status: column } : t))
      );

      apiRequest(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: column }),
      })
        .then(() => {
          toast.success('Task moved successfully!', { id: 'move-task' });
        })
        .catch((err) => {
          console.error('Failed to update task status:', err);
          toast.error('Failed to move task', { id: 'move-task' });
        });
    }
  };

  const handleTaskStatusChange = (taskId: string, newStatus: ColumnType) => {
    toast.loading('Updating task status...', { id: 'update-status' });
    setTasks(
      tasks.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    apiRequest(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    })
      .then(() => {
        toast.success('Task status updated!', { id: 'update-status' });
      })
      .catch((err) => {
        console.error('Failed to update task status:', err);
        toast.error('Failed to update task status', { id: 'update-status' });
      });
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority as 'LOW' | 'MEDIUM' | 'HIGH');
    setProjectId(task.projectId || '');
    setAssigneeId(task.assignee || '');
    setDueDate(task.dueDate || '');
    setEditTaskOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      setLoading(true);
      toast.loading('Updating task...', { id: 'edit-task' });

      const response = await apiRequest(`/api/tasks/${editingTask._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          priority,
          assignee: assigneeId || undefined,
          dueDate: dueDate || undefined,
        }),
      });

      if (response.success) {
        setTasks(
          tasks.map((t) =>
            t._id === editingTask._id
              ? {
                  ...t,
                  title,
                  description,
                  priority,
                  assignee: assigneeId,
                  assigneeName: teamMembers.find((m) => m._id === assigneeId)
                    ?.name,
                  dueDate: dueDate || undefined,
                }
              : t
          )
        );
        setEditTaskOpen(false);
        setEditingTask(null);
        toast.success('Task updated successfully!', { id: 'edit-task' });
      } else {
        toast.error(response.message || 'Failed to update task', {
          id: 'edit-task',
        });
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update task',
        { id: 'edit-task' }
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskMenu = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskMenuOpen(taskMenuOpen === taskId ? null : taskId);
  };

  const columns: { id: ColumnType; title: string; count: number }[] = [
    { id: 'TODO', title: 'To Do', count: todoCount },
    { id: 'IN_PROGRESS', title: 'In Progress', count: inProgressCount },
    { id: 'COMPLETED', title: 'Completed', count: doneCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Global Search and Priority Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/workspace/${workspaceId}/projects/${projectId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to project
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Kanban Board</h1>
          {/* Progress Bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {progressPercentage}% complete
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted/50 py-2 pr-4 pl-10 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as PriorityFilter)
            }
            className="rounded-lg border border-input bg-muted/50 px-4 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Clear Board Button */}
          <button
            onClick={clearBoard}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-red-600 dark:text-red-300 transition-colors hover:bg-red-50 dark:bg-red-500/10"
          >
            <RotateCcw className="h-4 w-4" />
            Clear Board
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar Form + Kanban Columns */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left Sidebar - Task Assignment Form */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-1 text-base font-semibold tracking-tight">Create Task</h2>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Quick add</p>
            <form onSubmit={submit} className="space-y-4">
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Task Title
                </label>
                <input
                  ref={titleInputRef}
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Task description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')
                  }
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Project
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    <option value="">Select Project (Optional)</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {teamMembers.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    <option value="">Select Assignee (Optional)</option>
                    {teamMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-sheen flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 p-3 text-sm font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                )}
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side - Kanban Columns */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {columns.map((column) => {
              const columnTasks = getTasksByColumn(column.id);

              return (
                <div
                  key={column.id}
                  className="rounded-2xl border border-border/60 bg-muted/40 p-3.5"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {/* Column Header */}
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          column.id === 'TODO'
                            ? 'bg-muted-foreground/50'
                            : column.id === 'IN_PROGRESS'
                              ? 'bg-primary'
                              : 'bg-emerald-500'
                        }`}
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">
                        {column.title}
                      </h3>
                    </div>
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
                      {column.count}
                    </span>
                  </div>

                  {/* Task Cards */}
                  <div className="space-y-3">
                    {columnTasks.map((task) => (
                      <div
                        key={task._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task._id)}
                        className="relative cursor-move rounded-xl border border-border bg-card p-3.5 pl-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-popover"
                      >
                        {/* Priority stripe */}
                        <span
                          className={`absolute inset-y-3 left-0 w-1 rounded-full ${
                            task.priority === 'HIGH' || task.priority === 'URGENT'
                              ? 'bg-red-500'
                              : task.priority === 'MEDIUM'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="mb-2 flex items-start justify-between">
                          <h4 className="text-sm font-medium text-foreground">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${getPriorityColor(task.priority)}`}
                            >
                              {task.priority}
                            </span>
                            <button
                              onClick={(e) => toggleTaskMenu(task._id, e)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Task options"
                              aria-label={`Options for ${task.title}`}
                              aria-expanded={taskMenuOpen === task._id}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {/* Task Menu */}
                        {taskMenuOpen === task._id && (
                          <div className="absolute top-12 right-2 z-10 rounded-xl border border-border bg-popover p-1.5 shadow-popover">
                            <select
                              value={task.status}
                              aria-label={`Move ${task.title} to status`}
                              onChange={(e) => {
                                handleTaskStatusChange(
                                  task._id,
                                  e.target.value as ColumnType
                                );
                                setTaskMenuOpen(null);
                              }}
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/25 focus:outline-none"
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </div>
                        )}

                        {task.description && (
                          <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {task.projectName && (
                            <span className="rounded bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-blue-700 dark:text-blue-300">
                              {task.projectName}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <span>{formatRelativeTime(task.createdAt)}</span>
                        </div>

                        {/* Assignee */}
                        {task.assigneeName && (
                          <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/15">
                              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                {task.assigneeName.charAt(0)}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {task.assigneeName}
                            </span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveTask(task._id, 'left')}
                              disabled={column.id === 'TODO'}
                              className="rounded p-1.5 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move left"
                            >
                              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => moveTask(task._id, 'right')}
                              disabled={column.id === 'COMPLETED'}
                              className="rounded p-1.5 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move right"
                            >
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditModal(task)}
                              className="rounded p-1.5 transition-colors hover:bg-blue-50 dark:bg-blue-500/10"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4 text-muted-foreground hover:text-blue-600 dark:text-blue-300" />
                            </button>
                            <button
                              onClick={() => deleteTask(task._id)}
                              className="rounded p-1.5 transition-colors hover:bg-red-50 dark:bg-red-500/10"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600 dark:text-red-300" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inline Add Task Button */}
                  {inlineTaskColumn === column.id ? (
                    <div className="mt-3">
                      <input
                        ref={inlineInputRef}
                        type="text"
                        placeholder="Enter task title and press Enter..."
                        value={inlineTaskTitle}
                        onChange={(e) => setInlineTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleInlineTaskSubmit(column.id);
                          } else if (e.key === 'Escape') {
                            setInlineTaskColumn(null);
                            setInlineTaskTitle('');
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setInlineTaskColumn(null);
                            setInlineTaskTitle('');
                          }, 200);
                        }}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setInlineTaskColumn(column.id);
                        setTimeout(() => inlineInputRef.current?.focus(), 0);
                      }}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" />
                      Add Task
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Task Modal */}
      {editTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Task</h2>
              <button
                onClick={() => {
                  setEditTaskOpen(false);
                  setEditingTask(null);
                }}
                className="rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Task Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')
                  }
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Project
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    <option value="">Select Project (Optional)</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {teamMembers.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    <option value="">Select Assignee (Optional)</option>
                    {teamMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-md border border-border p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditTaskOpen(false);
                    setEditingTask(null);
                  }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 transition-colors hover:bg-muted"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  )}
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
