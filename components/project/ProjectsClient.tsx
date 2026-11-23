// components/project/ProjectsClient.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  Archive,
  Trash2,
  MoreVertical,
  X,
  CheckSquare2,
  Search,
} from 'lucide-react';

interface Project {
  _id: string;
  name: string;
  status: string;
  progress?: number;
  description?: string;
  createdAt?: string;
  createdBy?: string;
}

interface Props {
  workspaceId: string;
  projects: Project[];
}

type FilterType = 'all' | 'active' | 'completed' | 'archived';

export default function ProjectsClient({
  workspaceId,
  projects: initialProjects,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set()
  );
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate counts for badges
  const allCount = projects.length;
  const activeCount = projects.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'active' || p.status === 'in-progress'
  ).length;
  const completedCount = projects.filter((p) => p.status === 'COMPLETED' || p.status === 'completed').length;
  const archivedCount = projects.filter((p) => p.status === 'archived').length;

  const filteredProjects = projects.filter((project) => {
    // Apply status filter
    const statusMatch =
      filter === 'all' ||
      (filter === 'active' &&
        (project.status === 'ACTIVE' || project.status === 'active' || project.status === 'in-progress')) ||
      (filter === 'completed' &&
        (project.status === 'COMPLETED' || project.status === 'completed')) ||
      (filter === 'archived' && project.status === 'archived');

    // Apply search filter (using debounced query)
    const searchMatch =
      debouncedSearchQuery === '' ||
      project.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      (project.description &&
        project.description
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase()));

    return statusMatch && searchMatch;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticProject: Project = {
      _id: tempId,
      name,
      description,
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    setProjects([...projects, optimisticProject]);

    try {
      setLoading(true);
      const response = await apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          workspace: workspaceId,
        }),
      });

      if (response.success) {
        setName('');
        setDescription('');
        // Replace optimistic update with real data
        setProjects(
          projects.map((p) => (p._id === tempId ? response.data : p))
        );
        router.refresh();
      } else {
        // Rollback optimistic update
        setProjects(projects.filter((p) => p._id !== tempId));
        setError(response.message || 'Failed to create project');
      }
    } catch (err: unknown) {
      // Rollback optimistic update
      setProjects(projects.filter((p) => p._id !== tempId));
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateProjectFocus = () => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      case 'in-progress':
      case 'active':
        return 'border-primary/25 bg-primary/10 text-primary';
      case 'archived':
        return 'border-border bg-muted text-muted-foreground';
      default:
        return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
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
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleDelete = async (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    // Optimistic UI update
    const projectToDeleteData = projects.find((p) => p._id === projectToDelete);
    setProjects(projects.filter((p) => p._id !== projectToDelete));
    setDeleteModalOpen(false);
    setProjectToDelete(null);

    try {
      await apiRequest(`/api/projects/${projectToDelete}`, {
        method: 'DELETE',
      });
      router.refresh();
    } catch (err) {
      // Rollback optimistic update
      if (projectToDeleteData) {
        setProjects([...projects, projectToDeleteData]);
      }
      console.error('Failed to delete project:', err);
    }
  };

  const handleArchive = async (projectId: string) => {
    const project = projects.find((p) => p._id === projectId);
    if (!project) return;

    const isUnarchiving = project.status === 'archived';
    const newStatus = isUnarchiving ? 'active' : 'archived';

    // Optimistic UI update
    setProjects(
      projects.map((p) =>
        p._id === projectId ? { ...p, status: newStatus } : p
      )
    );

    try {
      await apiRequest(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          status: newStatus,
          unarchive: isUnarchiving // Flag to trigger progress-based status
        }),
      });
      router.refresh();
    } catch (err) {
      // Rollback optimistic update
      setProjects(
        projects.map((p) =>
          p._id === projectId ? { ...p, status: project.status } : p
        )
      );
      console.error('Failed to archive project:', err);
    }
  };

  const toggleMenu = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === projectId ? null : projectId);
  };

  const closeMenu = () => {
    setMenuOpen(null);
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const selectAllProjects = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map((p) => p._id)));
    }
  };

  const bulkDelete = async () => {
    if (selectedProjects.size === 0) return;

    if (
      confirm(
        `Are you sure you want to delete ${selectedProjects.size} project(s)? This action cannot be undone.`
      )
    ) {
      // Optimistic UI update
      const projectsToDelete = projects.filter((p) =>
        selectedProjects.has(p._id)
      );
      setProjects(projects.filter((p) => !selectedProjects.has(p._id)));
      setSelectedProjects(new Set());

      try {
        await Promise.all(
          Array.from(selectedProjects).map((id) =>
            apiRequest(`/api/projects/${id}`, { method: 'DELETE' })
          )
        );
        router.refresh();
      } catch (err) {
        // Rollback optimistic update
        setProjects([...projects, ...projectsToDelete]);
        console.error('Failed to delete projects:', err);
      }
    }
  };

  const bulkArchive = async () => {
    if (selectedProjects.size === 0) return;

    const newStatus = filter === 'archived' ? 'active' : 'archived';

    // Optimistic UI update
    setProjects(
      projects.map((p) =>
        selectedProjects.has(p._id) ? { ...p, status: newStatus } : p
      )
    );
    setSelectedProjects(new Set());

    try {
      await Promise.all(
        Array.from(selectedProjects).map((id) =>
          apiRequest(`/api/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      router.refresh();
    } catch (err) {
      // Rollback would be complex here, just refresh
      router.refresh();
      console.error('Failed to archive projects:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1>
      </div>

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Form Panel (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-1 text-base font-semibold tracking-tight">Create New Project</h2>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Quick add</p>
            <form onSubmit={submit} className="space-y-4">
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Project Name
                </label>
                <input
                  ref={nameInputRef}
                  className="w-full rounded-lg border border-input bg-muted/50 p-3 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  className="w-full rounded-lg border border-input bg-muted/50 p-3 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Project description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
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
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Projects List (2/3 width) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Tab-Based Filtering */}
          <div className="rounded-2xl border border-border bg-card p-1.5 shadow-card">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'active', 'completed', 'archived'] as FilterType[]).map(
                (filterType) => {
                  const count =
                    filterType === 'all'
                      ? allCount
                      : filterType === 'active'
                        ? activeCount
                        : filterType === 'completed'
                          ? completedCount
                          : archivedCount;
                  return (
                    <button
                      key={filterType}
                      onClick={() => setFilter(filterType)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        filter === filterType
                          ? 'bg-primary text-primary-foreground shadow-glow'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {filterType.charAt(0).toUpperCase() + filterType.slice(1)}{' '}
                      Projects
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums ${
                          filter === filterType
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Live Search Bar */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted/50 py-2 pr-4 pl-10 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              />
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedProjects.size > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <span className="text-sm text-blue-800 dark:text-blue-300">
                {selectedProjects.size} project
                {selectedProjects.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={bulkArchive}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  {filter === 'archived' ? 'Restore' : 'Archive'}
                </button>
                <button
                  onClick={bulkDelete}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedProjects(new Set())}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Projects List or Empty State */}
          {filteredProjects.length === 0 ? (
            debouncedSearchQuery ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-card">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  No matches found
                </h3>
                <p className="mb-4 text-muted-foreground">
                  Try adjusting your search terms or filters
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                  }}
                  className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <EmptyState type="projects" onAction={handleCreateProjectFocus} />
            )
          ) : (
            <div className="space-y-3">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-2 px-2">
                <input
                  type="checkbox"
                  checked={
                    selectedProjects.size === filteredProjects.length &&
                    filteredProjects.length > 0
                  }
                  onChange={selectAllProjects}
                  className="h-4 w-4 rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>

              {filteredProjects.map((project) => (
                <div
                  key={project._id}
                  className={`relative rounded-2xl border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-popover ${
                    selectedProjects.has(project._id)
                      ? 'ring-2 ring-primary'
                      : ''
                  }`}
                >
                  <Link
                    href={`/workspace/${workspaceId}/projects/${project._id}`}
                    className="absolute inset-0 z-0"
                  />

                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex flex-1 items-start gap-3">
                      {/* Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(project._id)}
                        onChange={() => toggleProjectSelection(project._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="pointer-events-auto mt-1 h-4 w-4 rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                      />

                      <div className="pointer-events-none min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">
                            {project.name}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusColor(project.status)}`}
                          >
                            {project.status}
                          </span>
                        </div>

                        {project.description && (
                          <p className="mb-3 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        )}

                        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>Progress:</span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                                style={{ width: `${project.progress ?? 0}%` }}
                              />
                            </div>
                            <span className="font-mono tabular-nums">{project.progress ?? 0}%</span>
                          </div>
                          {project.createdAt && (
                            <span>
                              Created {formatRelativeTime(project.createdAt)}
                            </span>
                          )}
                          {project.createdBy && (
                            <span>by {project.createdBy}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Icons */}
                    <div className="ml-4 flex shrink-0 items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleArchive(project._id);
                        }}
                        className="pointer-events-auto rounded-lg p-2 transition-colors hover:bg-muted"
                        title={
                          project.status === 'archived'
                            ? 'Unarchive'
                            : 'Archive'
                        }
                      >
                        <Archive className="h-4 w-4 text-muted-foreground hover:text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(project._id);
                        }}
                        className="pointer-events-auto rounded-lg p-2 transition-colors hover:bg-red-50 dark:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600 dark:text-red-300" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => toggleMenu(project._id, e)}
                          className="pointer-events-auto rounded-lg p-2 transition-colors hover:bg-muted"
                          title="More"
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-muted-foreground" />
                        </button>

                        {/* Dropdown Menu */}
                        {menuOpen === project._id && (
                          <div className="animate-scale-in absolute top-full right-0 z-50 mt-1 w-48 rounded-xl border border-border bg-popover p-1.5 shadow-popover">
                            <div className="py-1">
                              {project.status === 'archived' ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleArchive(project._id);
                                    closeMenu();
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-green-600 dark:text-green-300 hover:bg-green-50 dark:bg-green-500/10"
                                >
                                  <Archive className="h-4 w-4" />
                                  Restore to Active
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleArchive(project._id);
                                    closeMenu();
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDelete(project._id);
                                  closeMenu();
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="animate-scale-in mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-popover">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Delete Project
              </h3>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <p className="mb-6 text-muted-foreground">
              Are you sure you want to delete this project? This action cannot
              be undone and all associated tasks will be removed.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setProjectToDelete(null);
                }}
                className="rounded-lg px-4 py-2 text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
