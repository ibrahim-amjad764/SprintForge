// components/admin/AdminDashboard.tsx
'use client';

import { useEffect, useState } from 'react';

/*
Admin Dashboard v2 — tabbed overview of the platform.

All data comes from /api/admin/* endpoints which independently
enforce DB-backed requireAdmin(). This component only renders;
it never decides authorization.

Tabs: Overview (stats) · Users (search/role mgmt) · Workspaces · Audit Log.
*/

type Tab = 'overview' | 'users' | 'workspaces' | 'audit';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
  createdAt?: string;
}

interface AdminWorkspace {
  _id: string;
  name: string;
  slug: string;
  owner?: { name?: string; email?: string } | string | null;
  memberCount: number;
  maxMembers?: number;
  createdAt?: string;
}

interface AuditEntry {
  _id: string;
  action: string;
  target: string;
  description: string;
  createdAt: string;
  user?: { name?: string; email?: string } | string | null;
}

interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  totalWorkspaces: number;
  totalMembers: number;
  totalTasks: number;
  totalAuditLogs: number;
  newUsers30d: number;
  newWorkspaces30d: number;
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'ready'; data: T };

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'audit', label: 'Audit Log' },
];

function useAdminFetch<T>(url: string) {
  const [reloadTick, setReloadTick] = useState(0);
  // Keyed result: loading is derived — a fetch "in flight" for a
  // different url/tick renders as loading without a sync setState
  // inside the effect (react-hooks/set-state-in-effect safe).
  const [result, setResult] = useState<{ key: string; state: LoadState<T> } | null>(null);
  const key = `${reloadTick}:${url}`;

  useEffect(() => {
    let cancelled = false;
    const requestKey = key;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        let next: LoadState<T>;
        if (res.status === 401) next = { status: 'unauthorized' };
        else if (res.status === 403) next = { status: 'forbidden' };
        else if (!res.ok) {
          next = { status: 'error', message: `Request failed (${res.status})` };
        } else {
          const body = await res.json();
          next = { status: 'ready', data: body?.data as T };
        }
        setResult({ key: requestKey, state: next });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            state: {
              status: 'error',
              message: 'Network error — could not reach the server.',
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadTick]);

  const state: LoadState<T> =
    result && result.key === key ? result.state : { status: 'loading' };

  return { state, reload: () => setReloadTick((t) => t + 1) };
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 shadow-card">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function StateMessage({
  kind,
  title,
  message,
  onRetry,
}: {
  kind: 'unauthorized' | 'forbidden' | 'error' | 'empty';
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const styles = {
    unauthorized: 'border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300',
    forbidden: 'border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-300',
    error: 'border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-300',
    empty: 'border-border bg-card text-foreground',
  }[kind];

  return (
    <div className={`rounded-2xl border p-8 text-center shadow-card ${styles}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && <p className="mt-2 text-sm opacity-80">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function PaginationBar({
  pagination,
  onPage,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-3 text-sm text-muted-foreground">
      <span className="font-mono text-xs tabular-nums">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total
      </span>
      <div className="flex gap-2">
        <button
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-xs rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
    />
  );
}

// ---------- Overview tab ----------

function OverviewTab() {
  const { state, reload } = useAdminFetch<AdminStats>('/api/admin/stats');

  if (state.status === 'loading') return <LoadingSpinner label="Loading stats" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const s = state.data;
  const cards: { label: string; value: number; hint?: string }[] = [
    { label: 'Total Users', value: s.totalUsers, hint: `+${s.newUsers30d} in 30d` },
    { label: 'Administrators', value: s.adminUsers },
    { label: 'Workspaces', value: s.totalWorkspaces, hint: `+${s.newWorkspaces30d} in 30d` },
    { label: 'Workspace Members', value: s.totalMembers },
    { label: 'Tasks', value: s.totalTasks },
    { label: 'Audit Events', value: s.totalAuditLogs },
  ];

  return (
    <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3">
      {cards.map((c, i) => (
        <div
          key={c.label}
          style={{ '--i': i } as React.CSSProperties}
          className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-popover"
        >
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{c.label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {c.value.toLocaleString()}
          </p>
          {c.hint && <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------- Users tab ----------

function UsersTab() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('q', debouncedSearch);
  if (roleFilter) params.set('role', roleFilter);
  const url = `/api/admin/users?${params.toString()}`;

  const { state, reload } = useAdminFetch<{ users: AdminUser[]; pagination: Pagination }>(url);

  // Filter change → back to page 1 (render-phase adjustment).
  const filterKey = `${debouncedSearch}|${roleFilter}`;
  const [seenFilterKey, setSeenFilterKey] = useState(filterKey);
  if (filterKey !== seenFilterKey) {
    setSeenFilterKey(filterKey);
    setPage(1);
  }

  async function changeRole(user: AdminUser, newRole: 'USER' | 'ADMIN') {
    if (user.role === newRole) return;
    if (
      !window.confirm(
        `Change ${user.email} from ${user.role} to ${newRole}? This takes effect immediately.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/users/${user._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      reload();
    } else {
      const body = await res.json().catch(() => null);
      window.alert(body?.message || 'Role update failed');
    }
  }

  if (state.status === 'loading') return <LoadingSpinner label="Loading users" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const { users, pagination } = state.data;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      {users.length === 0 ? (
        <StateMessage kind="empty" title="No users found" message="Try adjusting your search or filters." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">User</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Role</th>
                  <th className="hidden px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:table-cell">Joined</th>
                  <th className="px-6 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {users.map((user) => (
                  <tr key={user._id} className="transition-colors hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          user.role === 'ADMIN'
                            ? 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-muted-foreground sm:table-cell">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value as 'USER' | 'ADMIN')}
                        className="rounded-lg border border-input bg-muted/50 px-2 py-1.5 text-xs transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
                        aria-label={`Change role for ${user.email}`}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={pagination} onPage={setPage} />
        </div>
      )}
    </Shell>
  );
}

// ---------- Workspaces tab ----------

function WorkspacesTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('q', debouncedSearch);

  const { state, reload } = useAdminFetch<{ workspaces: AdminWorkspace[]; pagination: Pagination }>(
    `/api/admin/workspaces?${params.toString()}`
  );

  const [seenSearch, setSeenSearch] = useState(debouncedSearch);
  if (debouncedSearch !== seenSearch) {
    setSeenSearch(debouncedSearch);
    setPage(1);
  }

  if (state.status === 'loading') return <LoadingSpinner label="Loading workspaces" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const { workspaces, pagination } = state.data;

  return (
    <Shell>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or slug…" />
      {workspaces.length === 0 ? (
        <StateMessage kind="empty" title="No workspaces found" message="Try a different search." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Workspace</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Owner</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Members</th>
                  <th className="hidden px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {workspaces.map((w) => {
                  const owner = typeof w.owner === 'object' && w.owner !== null ? w.owner : null;
                  return (
                    <tr key={w._id} className="transition-colors hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{w.name}</p>
                        <p className="text-sm text-muted-foreground">/{w.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {owner ? owner.name || owner.email : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {w.memberCount}
                        {w.maxMembers ? ` / ${w.maxMembers}` : ''}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-muted-foreground sm:table-cell">
                        {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={pagination} onPage={setPage} />
        </div>
      )}
    </Shell>
  );
}

// ---------- Audit tab ----------

function AuditTab() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const debouncedAction = useDebounced(actionFilter, SEARCH_DEBOUNCE_MS);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('q', debouncedSearch);
  if (debouncedAction) params.set('action', debouncedAction);

  const { state, reload } = useAdminFetch<{ logs: AuditEntry[]; pagination: Pagination }>(
    `/api/admin/logs?${params.toString()}`
  );

  const filterKey = `${debouncedSearch}|${debouncedAction}`;
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (filterKey !== seenFilter) {
    setSeenFilter(filterKey);
    setPage(1);
  }

  if (state.status === 'loading') return <LoadingSpinner label="Loading audit log" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const { logs, pagination } = state.data;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search action, target, description…" />
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action (e.g. ADMIN_ROLE_CHANGE)"
          className="w-full max-w-xs rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
        />
      </div>

      {logs.length === 0 ? (
        <StateMessage kind="empty" title="No audit entries" message="Administrative actions will appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">When</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Actor</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Action</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Target</th>
                  <th className="hidden px-6 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground lg:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {logs.map((log) => {
                  const actor = typeof log.user === 'object' && log.user !== null ? log.user : null;
                  return (
                    <tr key={log._id} className="transition-colors hover:bg-muted/50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {actor ? actor.name || actor.email : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-primary">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{log.target}</td>
                      <td className="hidden max-w-xs truncate px-6 py-4 text-sm text-muted-foreground lg:table-cell">
                        {log.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={pagination} onPage={setPage} />
        </div>
      )}
    </Shell>
  );
}

// ---------- Root ----------

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`min-w-0 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 sm:px-4 sm:text-sm ${
              tab === t.id ? 'bg-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'workspaces' && <WorkspacesTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
