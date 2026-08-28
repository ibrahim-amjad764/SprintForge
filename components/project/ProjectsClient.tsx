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
        return 'bg-green-100 text-green-800';
      case 'in-progress':
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
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
      <h1 className="text-3xl font-bold">Projects</h1>

      {/* 2-Column Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Form Panel (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Create New Project</h2>
            <form onSubmit={submit} className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Project Name
                </label>
                <input
                  ref={nameInputRef}
                  className="w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 p-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
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
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {filterType.charAt(0).toUpperCase() + filterType.slice(1)}{' '}
                      Projects
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          filter === filterType
                            ? 'bg-blue-700 text-white'
                            : 'bg-gray-200 text-gray-700'
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
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedProjects.size > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
              <span className="text-sm text-blue-800">
                {selectedProjects.size} project
                {selectedProjects.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={bulkArchive}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
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
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Projects List or Empty State */}
          {filteredProjects.length === 0 ? (
            debouncedSearchQuery ? (
              <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                <Search className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No matches found
                </h3>
                <p className="mb-4 text-gray-600">
                  Try adjusting your search terms or filters
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
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
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Select all</span>
              </div>

              {filteredProjects.map((project) => (
                <div
                  key={project._id}
                  className={`relative rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                    selectedProjects.has(project._id)
                      ? 'ring-2 ring-blue-500 ring-offset-2'
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
                        className="pointer-events-auto mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div className="pointer-events-none flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {project.name}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusColor(project.status)}`}
                          >
                            {project.status}
                          </span>
                        </div>

                        {project.description && (
                          <p className="mb-3 text-sm text-gray-600">
                            {project.description}
                          </p>
                        )}

                        <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <span>Progress:</span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${project.progress ?? 0}%` }}
                              />
                            </div>
                            <span>{project.progress ?? 0}%</span>
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
                    <div className="ml-4 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleArchive(project._id);
                        }}
                        className="pointer-events-auto rounded-lg p-2 transition-colors hover:bg-gray-100"
                        title={
                          project.status === 'archived'
                            ? 'Unarchive'
                            : 'Archive'
                        }
                      >
                        <Archive className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(project._id);
                        }}
                        className="pointer-events-auto rounded-lg p-2 transition-colors hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => toggleMenu(project._id, e)}
                          className="pointer-events-auto rounded-lg p-2 transition-colors hover:bg-gray-100"
                          title="More"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>

                        {/* Dropdown Menu */}
                        {menuOpen === project._id && (
                          <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-lg border bg-white shadow-lg">
                            <div className="py-1">
                              {project.status === 'archived' ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleArchive(project._id);
                                    closeMenu();
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50"
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
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
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
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Project
              </h3>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this project? This action cannot
              be undone and all associated tasks will be removed.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setProjectToDelete(null);
                }}
                className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
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
