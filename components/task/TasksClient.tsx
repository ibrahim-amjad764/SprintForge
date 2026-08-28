'use client';

import { useState, useEffect } from 'react';
import TasksList from './TasksList';
import GlobalFilter, { FilterState } from '../filters/GlobalFilter';
import { Task } from '../calendar/Calendar';

interface TasksClientProps {
  projectId: string;
}

export default function TasksClient({ projectId }: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priority: [],
    status: [],
    assigneeId: [],
  });
  const [availableAssignees, setAvailableAssignees] = useState<{ id: string; name: string }[]>([]);

  // Load tasks from API on mount
  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks?project=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Transform DB tasks to match Task interface
            const transformedTasks = data.data.map((dbTask: any) => ({
              _id: dbTask._id,
              title: dbTask.title,
              description: dbTask.description,
              projectId: dbTask.project,
              assignedToId: dbTask.assignee?._id || dbTask.assignee,
              status: dbTask.status,
              priority: dbTask.priority,
              dueDate: dbTask.dueDate,
              createdAt: dbTask.createdAt,
              updatedAt: dbTask.updatedAt,
            }));
            setTasks(transformedTasks);
          }
        }
      } catch (error) {
        console.error('Error loading tasks from API:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, [projectId]);

  // Load teams for assignee dropdown
  useEffect(() => {
    async function loadTeams() {
      try {
        const workspaceId = window.location.pathname.split('/')[2];
        const response = await fetch(`/api/teams?workspace=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const assignees: { id: string; name: string }[] = [];
            data.data.forEach((team: any) => {
              if (team.members) {
                team.members.forEach((member: any) => {
                  assignees.push({ id: member._id || member.id, name: member.name });
                });
              }
            });
            setAvailableAssignees(assignees);
          }
        }
      } catch (error) {
        console.error('Error loading teams from API:', error);
      }
    }

    loadTeams();
  }, []);

  const handleTaskUpdated = async (updatedTask: Task) => {
    try {
      // Transform to DB format
      const dbTask = {
        title: updatedTask.title,
        description: updatedTask.description,
        project: updatedTask.projectId,
        assignee: updatedTask.assignedToId,
        status: updatedTask.status,
        priority: updatedTask.priority,
        dueDate: updatedTask.dueDate,
      };

      const response = await fetch(`/api/tasks/${updatedTask._id}`, {
        method: 'PUT',
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
            projectId: data.data.project,
            assignedToId: data.data.assignee?._id || data.data.assignee,
            status: data.data.status,
            priority: data.data.priority,
            dueDate: data.data.dueDate,
            createdAt: data.data.createdAt,
            updatedAt: data.data.updatedAt,
          };
          setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? transformedTask : t)));
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleTaskDeleted = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t._id !== taskId));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlobalFilter
        onFilterChange={handleFilterChange}
        availableAssignees={availableAssignees}
        showStatusFilter={true}
        showPriorityFilter={true}
        showAssigneeFilter={true}
      />
      <TasksList
        tasks={filteredTasks}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}
