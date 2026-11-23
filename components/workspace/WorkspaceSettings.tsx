// components/workspace/WorkspaceSettings.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import ImageUpload from '@/components/upload/ImageUpload';

interface WorkspaceSettingsData {
  theme?: 'light' | 'dark' | 'system';
  defaultTaskPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  defaultTaskStatus?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  defaultTaskView?: 'LIST' | 'BOARD' | 'CALENDAR';
  weekStartsOn?: 'MONDAY' | 'SUNDAY';
  emailNotifications?: boolean;
  taskAssignmentNotifications?: boolean;
  dueDateReminders?: boolean;
}

interface WorkspaceSettingsProps {
  workspaceId: string;

  workspace: {
    _id: string;
    name: string;
    description: string;
    logo: string;

    // Optional so this component remains compatible
    // with your current workspace object.
    settings?: WorkspaceSettingsData;
  };
}

type SettingsTab =
  | 'general'
  | 'preferences'
  | 'notifications'
  | 'danger';

const DEFAULT_SETTINGS: Required<WorkspaceSettingsData> = {
  theme: 'system',
  defaultTaskPriority: 'MEDIUM',
  defaultTaskStatus: 'TODO',
  defaultTaskView: 'LIST',
  weekStartsOn: 'MONDAY',
  emailNotifications: true,
  taskAssignmentNotifications: true,
  dueDateReminders: true,
};

export default function WorkspaceSettings({
  workspaceId,
  workspace,
}: WorkspaceSettingsProps) {
  const router = useRouter();

  // ---------------------------------------------------------
  // General workspace state
  // ---------------------------------------------------------

  const [name, setName] = useState(workspace.name || '');
  const [description, setDescription] = useState(
    workspace.description || ''
  );
  const [logo, setLogo] = useState(workspace.logo || '');

  // ---------------------------------------------------------
  // Workspace preference state
  // ---------------------------------------------------------

  const [settings, setSettings] = useState<Required<WorkspaceSettingsData>>({
    ...DEFAULT_SETTINGS,
    ...(workspace.settings || {}),
  });

  // ---------------------------------------------------------
  // UI state
  // ---------------------------------------------------------

  const [activeTab, setActiveTab] =
    useState<SettingsTab>('general');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [copied, setCopied] = useState(false);

  // ---------------------------------------------------------
  // Keep component synchronized with server data
  // ---------------------------------------------------------

  const [prevWorkspaceSync, setPrevWorkspaceSync] = useState({
    name: workspace.name,
    description: workspace.description,
    logo: workspace.logo,
    settings: workspace.settings,
  });
  if (
    prevWorkspaceSync.name !== workspace.name ||
    prevWorkspaceSync.description !== workspace.description ||
    prevWorkspaceSync.logo !== workspace.logo ||
    prevWorkspaceSync.settings !== workspace.settings
  ) {
    setPrevWorkspaceSync({
      name: workspace.name,
      description: workspace.description,
      logo: workspace.logo,
      settings: workspace.settings,
    });
    setName(workspace.name || '');
    setDescription(workspace.description || '');
    setLogo(workspace.logo || '');

    setSettings({
      ...DEFAULT_SETTINGS,
      ...(workspace.settings || {}),
    });
  }

  // ---------------------------------------------------------
  // Detect unsaved changes
  // ---------------------------------------------------------

  const isDirty = useMemo(() => {
    const originalSettings = {
      ...DEFAULT_SETTINGS,
      ...(workspace.settings || {}),
    };

    return (
      name.trim() !== (workspace.name || '').trim() ||
      description.trim() !== (workspace.description || '').trim() ||
      logo !== (workspace.logo || '') ||
      JSON.stringify(settings) !== JSON.stringify(originalSettings)
    );
  }, [
    name,
    description,
    logo,
    settings,
    workspace.name,
    workspace.description,
    workspace.logo,
    workspace.settings,
  ]);

  // ---------------------------------------------------------
  // Update individual workspace preference
  // ---------------------------------------------------------

  function updateSetting<K extends keyof WorkspaceSettingsData>(
    key: K,
    value: WorkspaceSettingsData[K]
  ) {
    console.log('⚙️ Workspace setting changed:', {
      key,
      value,
    });

    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setMessage('');
    setError('');
  }

  // ---------------------------------------------------------
  // Validate workspace settings
  // ---------------------------------------------------------

  function validateSettings(): boolean {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Workspace name is required.');
      setActiveTab('general');

      console.error('❌ Workspace validation failed: name is empty');

      return false;
    }

    if (trimmedName.length < 2) {
      setError(
        'Workspace name must contain at least 2 characters.'
      );
      setActiveTab('general');

      console.error(
        '❌ Workspace validation failed: name is too short'
      );

      return false;
    }

    if (trimmedName.length > 100) {
      setError(
        'Workspace name cannot exceed 100 characters.'
      );
      setActiveTab('general');

      console.error(
        '❌ Workspace validation failed: name is too long'
      );

      return false;
    }

    if (description.trim().length > 1000) {
      setError(
        'Workspace description cannot exceed 1000 characters.'
      );
      setActiveTab('general');

      console.error(
        '❌ Workspace validation failed: description too long'
      );

      return false;
    }

    return true;
  }

  // ---------------------------------------------------------
  // Save all workspace settings
  // ---------------------------------------------------------

  async function handleUpdate(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    console.log('🚀 Workspace settings save requested:', {
      workspaceId,
      isDirty,
      activeTab,
    });

    if (isSaving || isDeleting) {
      console.log(
        '⚠️ Workspace action already running. Request ignored.'
      );
      return;
    }

    setMessage('');
    setError('');

    if (!validateSettings()) {
      return;
    }

    if (!isDirty) {
      console.log(
        'ℹ️ No changes detected. Skipping API request.'
      );

      setMessage('Everything is already up to date.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        logo: logo || '',

        // New workspace settings.
        settings: {
          ...settings,
        },
      };

      console.log('📤 Sending workspace update:', {
        workspaceId,
        payload,
      });

      await apiRequest(
        `/api/workspaces/${workspaceId}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );

      console.log(
        '✅ Workspace settings saved successfully:',
        workspaceId
      );

      setMessage('Workspace settings saved successfully.');

      // Refresh Server Components with latest DB data.
      router.refresh();
    } catch (error) {
      console.error(
        '❌ Failed to update workspace settings:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save workspace settings.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------
  // Reset all local changes
  // ---------------------------------------------------------

  function handleReset() {
    console.log(
      '↩️ Resetting workspace settings to saved values'
    );

    setName(workspace.name || '');
    setDescription(workspace.description || '');
    setLogo(workspace.logo || '');

    setSettings({
      ...DEFAULT_SETTINGS,
      ...(workspace.settings || {}),
    });

    setError('');
    setMessage('Changes have been reset.');
  }

  // ---------------------------------------------------------
  // Copy workspace ID
  // ---------------------------------------------------------

  async function handleCopyWorkspaceId() {
    try {
      await navigator.clipboard.writeText(workspaceId);

      console.log(
        '📋 Workspace ID copied:',
        workspaceId
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        '❌ Failed to copy workspace ID:',
        error
      );

      setError('Unable to copy workspace ID.');
    }
  }

  // ---------------------------------------------------------
  // Delete workspace
  // ---------------------------------------------------------

  async function handleDelete() {
    if (isDeleting || isSaving) {
      console.log(
        '⚠️ Another workspace operation is running.'
      );
      return;
    }

    try {
      setIsDeleting(true);
      setError('');

      console.log(
        '🗑️ Deleting workspace:',
        workspaceId
      );

      await apiRequest(
        `/api/workspaces/${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      console.log(
        '✅ Workspace deleted successfully:',
        workspaceId
      );

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      console.error(
        '❌ Failed to delete workspace:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Failed to delete workspace.'
      );

      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  }

  // ---------------------------------------------------------
  // Tab button helper
  // ---------------------------------------------------------

  const tabs: {
    id: SettingsTab;
    label: string;
    description: string;
  }[] = [
    {
      id: 'general',
      label: 'General',
      description: 'Workspace identity and branding',
    },
    {
      id: 'preferences',
      label: 'Preferences',
      description: 'Default workspace behavior',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Control workspace notifications',
    },
    {
      id: 'danger',
      label: 'Danger Zone',
      description: 'Permanent workspace actions',
    },
  ];

  return (
    <div className="w-full max-w-5xl">
      {/* =====================================================
          Header
      ====================================================== */}

      <div className="mb-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Workspace Settings
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage your workspace, preferences,
              notifications, and security.
            </p>
          </div>

          {isDirty && (
            <div className="flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          Global Success / Error Messages
      ====================================================== */}

      {message && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-green-200 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* =====================================================
          Main Settings Layout
      ====================================================== */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* ===================================================
            Sidebar
        ==================================================== */}

        <aside className="h-fit rounded-xl border border-border bg-card p-2">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    console.log(
                      '⚙️ Settings tab:',
                      tab.id
                    );

                    setActiveTab(tab.id);
                    setError('');
                  }}
                  className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="text-sm font-medium">
                    {tab.label}
                  </div>

                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {tab.description}
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ===================================================
            Content
        ==================================================== */}

        <form
          onSubmit={handleUpdate}
          className="min-w-0"
        >
          {/* =================================================
              GENERAL
          ================================================== */}

          {activeTab === 'general' && (
            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-6 py-5">
                  <h2 className="font-semibold text-foreground">
                    General Information
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Update your workspace identity and
                    branding.
                  </p>
                </div>

                <div className="space-y-6 p-6">
                  {/* Workspace Name */}

                  <div>
                    <label
                      htmlFor="workspace-name"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Workspace Name
                    </label>

                    <input
                      id="workspace-name"
                      type="text"
                      value={name}
                      maxLength={100}
                      disabled={
                        isSaving || isDeleting
                      }
                      onChange={(e) => {
                        setName(e.target.value);
                        setError('');
                        setMessage('');
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2.5 outline-none transition focus:border-foreground/20 focus:ring-1 focus:ring-foreground/40 disabled:bg-muted"
                      placeholder="My Workspace"
                      required
                    />

                    <div className="mt-1 text-right text-xs text-muted-foreground">
                      {name.length}/100
                    </div>
                  </div>

                  {/* Description */}

                  <div>
                    <label
                      htmlFor="workspace-description"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Description
                    </label>

                    <textarea
                      id="workspace-description"
                      rows={5}
                      maxLength={1000}
                      value={description}
                      disabled={
                        isSaving || isDeleting
                      }
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setError('');
                        setMessage('');
                      }}
                      className="w-full resize-none rounded-lg border border-border px-3 py-2.5 outline-none transition focus:border-foreground/20 focus:ring-1 focus:ring-foreground/40 disabled:bg-muted"
                      placeholder="Describe what this workspace is used for..."
                    />

                    <div className="mt-1 text-right text-xs text-muted-foreground">
                      {description.length}/1000
                    </div>
                  </div>

                  {/* Logo */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Workspace Logo
                    </label>

                    <ImageUpload
                      currentImage={logo}
                      onUploadComplete={(uploadedLogo) => {
                        console.log(
                          '🖼️ Workspace logo uploaded:',
                          uploadedLogo
                        );

                        setLogo(uploadedLogo);
                        setMessage('');
                        setError('');
                      }}
                      folder="sprintforge/workspaces"
                      className="w-48"
                    />
                  </div>
                </div>
              </section>

              {/* Workspace Information */}

              <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-6 py-5">
                  <h2 className="font-semibold text-foreground">
                    Workspace Information
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Technical information about this
                    workspace.
                  </p>
                </div>

                <div className="p-6">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Workspace ID
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={workspaceId}
                      readOnly
                      className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-muted-foreground outline-none"
                    />

                    <button
                      type="button"
                      onClick={handleCopyWorkspaceId}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* =================================================
              PREFERENCES
          ================================================== */}

          {activeTab === 'preferences' && (
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="font-semibold text-foreground">
                  Workspace Preferences
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Configure default behavior for your
                  workspace and tasks.
                </p>
              </div>

              <div className="divide-y divide-border">
                {/* Theme */}

                <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Appearance
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose the default workspace theme.
                    </p>
                  </div>

                  <select
                    value={settings.theme}
                    onChange={(e) =>
                      updateSetting(
                        'theme',
                        e.target
                          .value as WorkspaceSettingsData['theme']
                      )
                    }
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/20"
                  >
                    <option value="system">
                      System
                    </option>
                    <option value="light">
                      Light
                    </option>
                    <option value="dark">
                      Dark
                    </option>
                  </select>
                </div>

                {/* Default Priority */}

                <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Default Task Priority
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Priority automatically selected when
                      creating a new task.
                    </p>
                  </div>

                  <select
                    value={
                      settings.defaultTaskPriority
                    }
                    onChange={(e) =>
                      updateSetting(
                        'defaultTaskPriority',
                        e.target
                          .value as WorkspaceSettingsData['defaultTaskPriority']
                      )
                    }
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/20"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">
                      Medium
                    </option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">
                      Urgent
                    </option>
                  </select>
                </div>

                {/* Default Status */}

                <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Default Task Status
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Status automatically applied to new
                      tasks.
                    </p>
                  </div>

                  <select
                    value={settings.defaultTaskStatus}
                    onChange={(e) =>
                      updateSetting(
                        'defaultTaskStatus',
                        e.target
                          .value as WorkspaceSettingsData['defaultTaskStatus']
                      )
                    }
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/20"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">
                      In Progress
                    </option>
                    <option value="REVIEW">
                      Review
                    </option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                {/* Default View */}

                <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Default Task View
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose how tasks should be displayed
                      by default.
                    </p>
                  </div>

                  <select
                    value={settings.defaultTaskView}
                    onChange={(e) =>
                      updateSetting(
                        'defaultTaskView',
                        e.target
                          .value as WorkspaceSettingsData['defaultTaskView']
                      )
                    }
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/20"
                  >
                    <option value="LIST">List</option>
                    <option value="BOARD">Board</option>
                    <option value="CALENDAR">
                      Calendar
                    </option>
                  </select>
                </div>

                {/* Week Start */}

                <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Week Starts On
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Used by calendar and date-based
                      workspace views.
                    </p>
                  </div>

                  <select
                    value={settings.weekStartsOn}
                    onChange={(e) =>
                      updateSetting(
                        'weekStartsOn',
                        e.target
                          .value as WorkspaceSettingsData['weekStartsOn']
                      )
                    }
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/20"
                  >
                    <option value="MONDAY">
                      Monday
                    </option>
                    <option value="SUNDAY">
                      Sunday
                    </option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* =================================================
              NOTIFICATIONS
          ================================================== */}

          {activeTab === 'notifications' && (
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="font-semibold text-foreground">
                  Notifications
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Control which workspace events generate
                  notifications.
                </p>
              </div>

              <div className="divide-y divide-border">
                {/* Email Notifications */}

                <label className="flex cursor-pointer items-center justify-between gap-4 p-6">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Email Notifications
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Receive important workspace updates
                      by email.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={
                      settings.emailNotifications
                    }
                    onChange={(e) =>
                      updateSetting(
                        'emailNotifications',
                        e.target.checked
                      )
                    }
                    className="h-5 w-5 rounded border-border text-foreground focus:ring-foreground/40"
                  />
                </label>

                {/* Assignment Notifications */}

                <label className="flex cursor-pointer items-center justify-between gap-4 p-6">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Task Assignment Notifications
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Notify members when they are assigned
                      a task.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={
                      settings.taskAssignmentNotifications
                    }
                    onChange={(e) =>
                      updateSetting(
                        'taskAssignmentNotifications',
                        e.target.checked
                      )
                    }
                    className="h-5 w-5 rounded border-border text-foreground focus:ring-foreground/40"
                  />
                </label>

                {/* Due Date Reminder */}

                <label className="flex cursor-pointer items-center justify-between gap-4 p-6">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Due Date Reminders
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Remind members when assigned tasks are
                      approaching their due date.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={settings.dueDateReminders}
                    onChange={(e) =>
                      updateSetting(
                        'dueDateReminders',
                        e.target.checked
                      )
                    }
                    className="h-5 w-5 rounded border-border text-foreground focus:ring-foreground/40"
                  />
                </label>
              </div>
            </section>
          )}

          {/* =================================================
              DANGER ZONE
          ================================================== */}

          {activeTab === 'danger' && (
            <section className="rounded-xl border border-red-200 dark:border-red-500/40 bg-card">
              <div className="border-b border-red-100 px-6 py-5">
                <h2 className="font-semibold text-red-700 dark:text-red-300">
                  Danger Zone
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  These actions can permanently affect your
                  workspace.
                </p>
              </div>

              <div className="p-6">
                <div className="rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-5">
                  <h3 className="font-medium text-red-800 dark:text-red-300">
                    Delete Workspace
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">
                    Permanently delete this workspace,
                    including its projects, tasks, members,
                    and associated data.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      console.log(
                        '⚠️ Delete confirmation opened:',
                        workspaceId
                      );

                      setShowDeleteModal(true);
                    }}
                    disabled={
                      isSaving || isDeleting
                    }
                    className="mt-4 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete Workspace
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* =================================================
              Sticky Save Bar
          ================================================== */}

          {activeTab !== 'danger' && (
            <div className="sticky bottom-4 mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                {isDirty ? (
                  <p className="text-sm font-medium text-foreground">
                    You have unsaved changes.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your workspace is up to date.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={
                    !isDirty ||
                    isSaving ||
                    isDeleting
                  }
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={
                    !isDirty ||
                    isSaving ||
                    isDeleting
                  }
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* =====================================================
          Delete Confirmation Modal
      ====================================================== */}

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-workspace-title"
        >
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
            <h3
              id="delete-workspace-title"
              className="text-xl font-semibold text-foreground"
            >
              Delete Workspace?
            </h3>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You are about to permanently delete{' '}
              <strong>{workspace.name}</strong>.
            </p>

            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                This action cannot be undone.
              </p>

              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                All projects, tasks, members, and workspace
                data associated with this workspace may be
                permanently removed.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setShowDeleteModal(false);
                  }
                }}
                disabled={isDeleting}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting
                  ? 'Deleting...'
                  : 'Yes, Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}