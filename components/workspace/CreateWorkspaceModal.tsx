'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import UpgradePrompt from '@/components/billing/UpgradePrompt';
import { useIsClient } from '@/hooks/useIsClient';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// --------------------------------------------------------
// Security: Basic client-side input sanitization.
// NOTE: Server-side validation/sanitization is still required.
// --------------------------------------------------------
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[;&]/g, '')
    .replace(/--/g, '')
    .replace(/script/gi, '')
    .trim();
}

// --------------------------------------------------------
// Generate a clean URL-friendly workspace slug.
// --------------------------------------------------------
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export default function CreateWorkspaceModal({
  isOpen,
  onClose,
}: CreateWorkspaceModalProps) {
  const router = useRouter();

  const modalRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  const mounted = useIsClient();

  const [name, setName] = useState('');
  const slug = useMemo(() => generateSlug(sanitizeInput(name)), [name]);
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  const [visibility, setVisibility] = useState<'private' | 'organization'>(
    'private'
  );

  const [template, setTemplate] = useState<
    'kanban' | 'scrum' | 'bug-tracker' | 'blank'
  >('blank');

  const [loading, setLoading] = useState(false);
  const isOnline = useOnlineStatus();

  const [errors, setErrors] = useState<{
    name?: string;
    emails?: string;
  }>({});

  const [isDirty, setIsDirty] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // --------------------------------------------------------
  // Portal mounting.
  //
  // Rendering the modal directly inside the page can cause
  // z-index / overflow / transform issues.
  //
  // Portal renders the modal directly under <body>.
  // --------------------------------------------------------

  // --------------------------------------------------------
  // Prevent page scrolling while modal is open.
  // --------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // --------------------------------------------------------
  // Track unsaved changes when the workspace name changes.
  // --------------------------------------------------------
  const handleNameChange = (value: string) => {
    setName(value);
    setIsDirty(sanitizeInput(value).length > 0);
  };

  // --------------------------------------------------------
  // Escape key closes modal.
  // --------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        console.log('Closing workspace modal with Escape key');
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, loading, isDirty]);

  // --------------------------------------------------------
  // Browser navigation protection.
  // --------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty && !loading) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, loading]);

  // --------------------------------------------------------
  // Add email member.
  // --------------------------------------------------------
  const addEmail = useCallback(() => {
    const email = emailInput.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      return;
    }

    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);

      setErrors((previous) => ({
        ...previous,
        emails: 'Invalid email format',
      }));

      return;
    }

    if (emails.includes(email)) {
      console.warn('Email already added:', email);

      setErrors((previous) => ({
        ...previous,
        emails: 'This email has already been added',
      }));

      return;
    }

    console.log('Adding workspace member email:', email);

    setEmails((previous) => [...previous, email]);
    setEmailInput('');

    setErrors((previous) => ({
      ...previous,
      emails: undefined,
    }));
  }, [emailInput, emails]);

  // --------------------------------------------------------
  // Remove email member.
  // --------------------------------------------------------
  const removeEmail = useCallback((emailToRemove: string) => {
    console.log('Removing workspace member email:', emailToRemove);

    setEmails((previous) =>
      previous.filter((email) => email !== emailToRemove)
    );
  }, []);

  // --------------------------------------------------------
  // Submit workspace creation.
  //
  // isSubmittingRef prevents double-click / duplicate requests.
  // This is safer than delaying preventDefault with debounce.
  // --------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current) {
      console.warn('Workspace creation already in progress');
      return;
    }

    if (!isOnline) {
      console.error('Cannot create workspace while offline');

      setErrors({
        name: 'Internet connection is unavailable',
      });

      return;
    }

    const sanitizedName = sanitizeInput(name);

    if (!sanitizedName) {
      console.error('Workspace name is required');

      setErrors({
        name: 'Workspace name is required',
      });

      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setErrors({});

    console.log('Creating workspace:', {
      name: sanitizedName,
      slug,
      visibility,
      template,
      members: emails.length,
    });

    try {
      const response = await apiRequest('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({
          name: sanitizedName,
          slug,
          members: emails,
          visibility,
          template,
        }),
      });

      console.log('Workspace creation response:', response);

      if (response.success) {
        console.log('Workspace created successfully:', response.data?._id);

        setIsDirty(false);

        onClose();

        if (response.data?._id) {
          router.push(`/workspace/${response.data._id}`);
        }
      } else {
        console.error('Workspace creation failed:', response.message);

        setErrors({
          name: response.message || 'Failed to create workspace',
        });
      }
    } catch (error) {
      console.error('Workspace creation request failed:', error);

      const apiErr = error as { status?: number; code?: string };
      if (apiErr.code === 'WORKSPACE_LIMIT_REACHED' || apiErr.status === 403) {
        setShowUpgrade(true);
      } else {
        setErrors({
          name:
            error instanceof Error
              ? error.message
              : 'An error occurred while creating workspace',
        });
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // --------------------------------------------------------
  // Close modal.
  //
  // If form has unsaved changes, ask before closing.
  // --------------------------------------------------------
  function handleCancel() {
    if (loading) {
      console.log('Close prevented because workspace creation is in progress');

      return;
    }

    if (isDirty) {
      const confirmed = window.confirm(
        'Your unsaved changes will be lost. Are you sure you want to leave?'
      );

      if (!confirmed) {
        return;
      }
    }

    console.log('Closing Create Workspace modal');

    setIsDirty(false);
    onClose();
  }

  // --------------------------------------------------------
  // Clicking the backdrop closes the modal.
  //
  // Important:
  // We check event.target === event.currentTarget so clicks
  // inside the modal do NOT close it.
  // --------------------------------------------------------
  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    console.log('Backdrop clicked - closing modal');

    handleCancel();
  }

  // --------------------------------------------------------
  // Don't render if modal is closed.
  // --------------------------------------------------------
  if (!isOpen || !mounted) {
    return null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sprintforge.com';

  // --------------------------------------------------------
  // Render modal through document.body.
  // This prevents parent layout/z-index issues.
  // --------------------------------------------------------
  return createPortal(
    <>
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workspace-title"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10"
        onMouseDown={(event) => {
          // Stop clicks inside the modal from reaching the backdrop.
          event.stopPropagation();
        }}
      >
        {/* ------------------------------------------------
            Close button
        ------------------------------------------------- */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          aria-label="Close create workspace modal"
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-xl leading-none">×</span>
        </button>

        <div className="max-h-[90vh] overflow-y-auto">
          <div className="grid lg:grid-cols-2">
            {/* =================================================
                LEFT COLUMN - FORM
            ================================================== */}
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="mb-6 pr-10">
                <h2
                  id="create-workspace-title"
                  className="text-2xl font-semibold text-foreground"
                >
                  Create New Workspace
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Set up your workspace and invite your team.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ------------------------------------------------
                    Workspace Name
                ------------------------------------------------- */}
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Workspace Name
                  </label>

                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-muted"
                    placeholder="e.g. Project Alpha"
                    required
                    disabled={!isOnline || loading}
                    maxLength={50}
                  />

                  {errors.name && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-300">{errors.name}</p>
                  )}

                  {/* URL Preview */}
                  {slug && (
                    <p className="mt-2 text-xs break-all text-muted-foreground">
                      URL:{' '}
                      <span className="text-foreground">
                        {appUrl}/workspace/{slug}
                      </span>
                    </p>
                  )}
                </div>

                {/* ------------------------------------------------
                    Visibility
                ------------------------------------------------- */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Visibility
                  </label>

                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="visibility"
                        value="private"
                        checked={visibility === 'private'}
                        onChange={() => setVisibility('private')}
                        className="text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                        disabled={loading}
                      />

                      <span className="text-sm text-foreground">
                        Private (invite only)
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="visibility"
                        value="organization"
                        checked={visibility === 'organization'}
                        onChange={() => setVisibility('organization')}
                        className="text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                        disabled={loading}
                      />

                      <span className="text-sm text-foreground">
                        Organization-wide
                      </span>
                    </label>
                  </div>
                </div>

                {/* ------------------------------------------------
                    Template Selection
                ------------------------------------------------- */}
                <div>
                  <label
                    htmlFor="template"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Default Template
                  </label>

                  <select
                    id="template"
                    value={template}
                    onChange={(e) =>
                      setTemplate(
                        e.target.value as
                          'kanban' | 'scrum' | 'bug-tracker' | 'blank'
                      )
                    }
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-muted"
                    disabled={loading}
                  >
                    <option value="blank">Blank Project</option>

                    <option value="kanban">Kanban Board</option>

                    <option value="scrum">Scrum Sprint</option>

                    <option value="bug-tracker">Bug Tracker</option>
                  </select>
                </div>

                {/* ------------------------------------------------
                    Team Members
                ------------------------------------------------- */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Team Members
                  </label>

                  <div className="flex gap-2">
                    <input
                      id="email"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEmail();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-muted"
                      placeholder="Enter email"
                      disabled={!isOnline || loading}
                    />

                    <button
                      type="button"
                      onClick={addEmail}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!isOnline || loading || !emailInput.trim()}
                    >
                      Add
                    </button>
                  </div>

                  {errors.emails && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-300">
                      {errors.emails}
                    </p>
                  )}

                  {/* Email Chips */}
                  {emails.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {emails.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300"
                        >
                          {email}

                          <button
                            type="button"
                            onClick={() => removeEmail(email)}
                            className="text-blue-400 transition hover:text-red-500 dark:text-red-400"
                            disabled={loading}
                            aria-label={`Remove ${email}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------
                    Offline Alert
                ------------------------------------------------- */}
                {!isOnline && (
                  <div className="rounded-lg border border-yellow-200 dark:border-yellow-500/40 bg-yellow-50 dark:bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                    ⚠️ Internet disconnected. Please check your connection.
                  </div>
                )}

                {/* ------------------------------------------------
                    Action Buttons
                ------------------------------------------------- */}
                <div className="flex justify-end gap-3 border-t border-border pt-5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!isOnline || loading}
                  >
                    {loading && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}

                    {loading ? 'Creating...' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            </div>

            {/* =================================================
                RIGHT COLUMN - LIVE PREVIEW
            ================================================== */}
            <div className="hidden border-l border-border bg-muted p-8 lg:block">
              <h3 className="mb-4 font-semibold text-foreground">Live Preview</h3>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                {/* Workspace Header */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/15 font-semibold text-blue-600 dark:text-blue-300">
                    {name.charAt(0).toUpperCase() || 'W'}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {name || 'Workspace Name'}
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {visibility === 'private'
                        ? '🔒 Private'
                        : '🌐 Organization'}
                    </p>
                  </div>
                </div>

                {/* Workspace Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>📋</span>

                    <span>
                      Template:{' '}
                      {template
                        .replace('-', ' ')
                        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>👥</span>

                    <span>
                      {emails.length + 1} member
                      {emails.length + 1 !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>🔗</span>

                    <span className="truncate text-xs">
                      /{slug || 'workspace-slug'}
                    </span>
                  </div>
                </div>

                {/* Team Members */}
                {emails.length > 0 && (
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Team Members
                    </p>

                    <div className="space-y-2">
                      {emails.slice(0, 3).map((email) => (
                        <div key={email} className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {email.charAt(0).toUpperCase()}
                          </div>

                          <span className="truncate text-xs text-muted-foreground">
                            {email}
                          </span>
                        </div>
                      ))}

                      {emails.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{emails.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <UpgradePrompt
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      returnTo="/workspace/new"
    />
    </>,
    document.body
  );
}
